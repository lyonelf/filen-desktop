import ipc from "../../ipc"
import memoryCache from "../../memoryCache"
import { convertTimestampToMs, Semaphore, isFolderPathExcluded, isSystemPathExcluded, pathIsFileOrFolderNameIgnoredByDefault, pathValidation, windowsPathToUnixStyle, pathIncludesDot, isNameOverMaxLength, isPathOverMaxLength } from "../../helpers"
import { downloadChunk } from "../../api"
import { decryptData } from "../../crypto"
import { v4 as uuidv4 } from "uuid"
import db from "../../db"
import * as constants from "../../constants"
import { isSyncLocationPaused } from "../../worker/sync/sync.utils"
import type { Stats } from "fs-extra"
import type { ReaddirFallbackEntry, LocalDirectoryTreeResult, LocalTreeFiles, LocalTreeFolders, LocalTreeIno, Location } from "../../../../types"
import { doesExistLocally } from "../remote"

const fs = window.require("fs-extra")
const pathModule = window.require("path")
const readdirp = window.require("readdirp")
const log = window.require("electron-log")
const is = window.require("electron-is")

const downloadThreadsSemaphore = new Semaphore(constants.maxDownloadThreads)
const FS_RETRIES = 8
const FS_RETRY_TIMEOUT = 100
const FS_RETRY_CODES = ["EAGAIN", "EBUSY", "ECANCELED", "EBADF", "EINTR", "EIO", "EMFILE", "ENFILE", "ENOMEM", "EPIPE", "ETXTBSY", "ESPIPE", "EAI_SYSTEM", "EAI_CANCELED"]
const FS_NORETRY_CODES = ["ENOENT", "ENODEV", "EACCES", "EPERM", "EINVAL", "ENAMETOOLONG", "ENOBUFS", "ENOSPC", "EROFS"]
const readdirFallback = new Map<string, ReaddirFallbackEntry>()
let LOCAL_TRASH_DIRS_CLEAN_INTERVAL: string | number | NodeJS.Timeout | undefined

export const normalizePath = (path: string): string => {
    return pathModule.normalize(path)
}

export const checkLastModified = (path: string): Promise<{ changed: boolean, mtimeMs?: number }> => {
    return new Promise((resolve, reject) => {
        path = normalizePath(path)

        gracefulLStat(path).then((stat: any) => {
            if(stat.mtimeMs > 0){
                return resolve({
                    changed: false
                })
            }

            const lastModified = new Date(new Date().getTime() - 60000)
            const mtimeMs = lastModified.getTime()
            
            let currentTries = 0
            let lastErr: any = undefined

            const req = () => {
                if(currentTries > FS_RETRIES){
                    return reject(lastErr)
                }

                currentTries += 1

                fs.utimes(path, lastModified, lastModified).then(() => {
                    return resolve({
                        changed: true,
                        mtimeMs 
                    })
                }).catch((err: any) => {
                    lastErr = err

                    if(FS_RETRY_CODES.includes(err.code)){
                        return setTimeout(req, FS_RETRY_TIMEOUT)
                    }
                    
                    return reject(err)
                })
            }

            return req()
        }).catch(reject)
    })
}

export const getTempDir = async (): Promise<string> => {
    if(memoryCache.has("tmpDir")){
        return memoryCache.get("tmpDir")
    }

    const tmpDirRes = await ipc.getAppPath("temp")
    const tmpDir = normalizePath(tmpDirRes)

    memoryCache.set("tmpDir", tmpDir)

    return tmpDir
}

export const smokeTest = (path: string): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
        path = normalizePath(path)

        try{
            const tmpDir = await getTempDir()

            if(!(await canReadWriteAtPath(path))){
                return reject(new Error("Cannot read/write at path " + path))
            }

            if(!(await canReadWriteAtPath(tmpDir))){
                return reject(new Error("Cannot read/write at path " + tmpDir))
            }

            await Promise.all([
                gracefulLStat(path),
                gracefulLStat(tmpDir)
            ])
        }
        catch(e){
            return reject(e)
        }

        return resolve(true)
    })
}

export const gracefulLStat = (path: string): Promise<Stats> => {
    return new Promise((resolve, reject) => {
        path = pathModule.normalize(path)

        const cacheKey: string = "gracefulLStat:" + path
        let currentTries = 0
        let lastErr: any = undefined

        const req = () => {
            if(currentTries > FS_RETRIES){
                return reject(lastErr)
            }

            currentTries += 1

            fs.lstat(path).then((stats: Stats) => {
                memoryCache.set(cacheKey, stats)

                return resolve(stats)
            }).catch((err: any) => {
                if(err.code == "EPERM" && memoryCache.has(cacheKey)){
                    return resolve(memoryCache.get(cacheKey))
                }

                lastErr = err

                if(FS_RETRY_CODES.includes(err.code)){
                    return setTimeout(req, FS_RETRY_TIMEOUT)
                }

                return reject(err)
            })
        }

        return req()
    })
}

export const exists = (fullPath: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const path = pathModule.normalize(fullPath)

        fs.access(path, fs.constants.F_OK, (err: any) => {
            if(err){
                return resolve(false)
            }

            return resolve(true)
        })
    })
}

export const canReadWriteAtPath = (fullPath: string): Promise<boolean> => {
    return new Promise((resolve) => {
        fullPath = pathModule.normalize(fullPath)

        const req = (path: string) => {
            fs.access(path, fs.constants.W_OK | fs.constants.R_OK, (err: any) => {
                if(err){
                    if(err.code){
                        if(err.code == "EPERM"){
                            log.error(err)

                            return resolve(false)
                        }
                        else if(err.code == "ENOENT"){
                            const newPath = pathModule.dirname(path)

                            if(newPath.length > 0){
                                return setImmediate(() => req(newPath))
                            }

                            return resolve(false)
                        }
                    }

                    log.error(err)
    
                    return resolve(false)
                }
    
                return resolve(true)
            })
        }

        return req(fullPath)
    })
}

export const directoryTree = (path: string, skipCache: boolean = false, location: Location): Promise<LocalDirectoryTreeResult> => {
    return new Promise((resolve, reject) => {
        const cacheKey = "directoryTreeLocal:" + location.uuid

        Promise.all([
            db.get("localDataChanged:" + location.uuid),
            db.get(cacheKey),
            db.get("excludeDot")
        ]).then(async ([localDataChanged, cachedLocalTree, excludeDot]) => {
            if(excludeDot == null){
                excludeDot = true
            }
            
            if(!localDataChanged && cachedLocalTree !== null && !skipCache){
                return resolve({
                    changed: false,
                    data: cachedLocalTree
                })
            }

            path = normalizePath(path)

            const files: LocalTreeFiles = {}
            const folders: LocalTreeFolders = {}
            const ino: LocalTreeIno = {}
            const windows: boolean = is.windows()
            let statting: number = 0

            const dirStream = readdirp(path, {
                alwaysStat: false,
                lstat: false,
                type: "all",
                depth: 2147483648,
                directoryFilter: ["!.filen.trash.local", "!System Volume Information"],
                fileFilter: ["!.filen.trash.local", "!System Volume Information"]
            })
            
            dirStream.on("data", async (item: { path: string, fullPath: string, basename: string, stats: Stats }) => {
                statting += 1

                const readdirFallbackKey = location.uuid + ":" + item.fullPath

                try{
                    if(windows){
                        item.path = windowsPathToUnixStyle(item.path)
                    }

                    let include = true
    
                    if(excludeDot && (item.basename.startsWith(".") || pathIncludesDot(item.path))){
                        include = false
                    }

                    if(!(await canReadWriteAtPath(item.fullPath))){
                        if(readdirFallback.has(readdirFallbackKey)){
                            const fallback = readdirFallback.get(readdirFallbackKey)

                            if(fallback){
                                if(fallback.ino.type == "file"){
                                    files[item.path] = fallback.entry
                                }
                                else{
                                    folders[item.path] = fallback.entry
                                }

                                ino[fallback.entry.ino] = fallback.ino

                                statting -= 1

                                log.error("Using fallback readdir entry for " + item.fullPath)

                                return
                            }
                        }

                        include = false
                    }
    
                    if(
                        include
                        && !isFolderPathExcluded(item.path)
                        && pathValidation(item.path)
                        && !pathIsFileOrFolderNameIgnoredByDefault(item.path)
                        && !isSystemPathExcluded("//" + item.fullPath)
                        && !isNameOverMaxLength(item.basename)
                        && !isPathOverMaxLength(location.local + "/" + item.path)
                    ){
                        item.stats = await gracefulLStat(item.fullPath)

                        if(!item.stats.isSymbolicLink()){
                            if(item.stats.isDirectory()){
                                const inoNum = parseInt(item.stats.ino.toString())
                                const entry = {
                                    name: item.basename,
                                    size: 0,
                                    lastModified: convertTimestampToMs(parseInt(item.stats.mtimeMs.toString())), //.toString() because of BigInt
                                    ino: inoNum
                                }

                                folders[item.path] = entry
                                ino[inoNum] = {
                                    type: "folder",
                                    path: item.path
                                }

                                const readdirFallbackEntry: ReaddirFallbackEntry = {
                                    entry,
                                    ino: {
                                        type: "folder",
                                        path: item.path
                                    }
                                }

                                readdirFallback.set(readdirFallbackKey, readdirFallbackEntry)
                            }
                            else{
                                if(item.stats.size > 0){
                                    const inoNum = parseInt(item.stats.ino.toString())
                                    const entry = {
                                        name: item.basename,
                                        size: parseInt(item.stats.size.toString()), //.toString() because of BigInt
                                        lastModified: convertTimestampToMs(parseInt(item.stats.mtimeMs.toString())), //.toString() because of BigInt
                                        ino: inoNum
                                    }

                                    files[item.path] = entry
                                    ino[inoNum] = {
                                        type: "file",
                                        path: item.path
                                    }

                                    const readdirFallbackEntry: ReaddirFallbackEntry = {
                                        entry,
                                        ino: {
                                            type: "file",
                                            path: item.path
                                        }
                                    }

                                    readdirFallback.set(readdirFallbackKey, readdirFallbackEntry)
                                }
                                else{
                                    if(readdirFallback.has(readdirFallbackKey)){
                                        const fallback = readdirFallback.get(readdirFallbackKey)

                                        if(fallback){
                                            if(fallback.ino.type == "file"){
                                                files[item.path] = fallback.entry
                                            }
                                            else{
                                                folders[item.path] = fallback.entry
                                            }

                                            ino[fallback.entry.ino] = fallback.ino

                                            log.error("Using fallback readdir entry for " + item.fullPath)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch(e){
                    log.error(e)

                    if(readdirFallback.has(readdirFallbackKey)){
                        const fallback = readdirFallback.get(readdirFallbackKey)

                        if(fallback){
                            if(fallback.ino.type == "file"){
                                files[item.path] = fallback.entry
                            }
                            else{
                                folders[item.path] = fallback.entry
                            }

                            ino[fallback.entry.ino] = fallback.ino

                            log.error("Using fallback readdir entry for " + item.fullPath)
                        }
                    }
                }

                statting -= 1
            })
            
            dirStream.on("warn", (warn: any) => {
                log.error("Readdirp warning:", warn)
            })
            
            dirStream.on("error", (err: Error) => {
                dirStream.destroy()

                statting = 0
                
                return reject(err)
            })
            
            dirStream.on("end", async () => {
                await new Promise((resolve) => {
                    if(statting <= 0){
                        return resolve(true)
                    }

                    const wait = setInterval(() => {
                        if(statting <= 0){
                            clearInterval(wait)

                            return resolve(true)
                        }
                    }, 10)
                })

                statting = 0

                dirStream.destroy()
                
                const obj = {
                    files,
                    folders,
                    ino
                }

                try{
                    await Promise.all([
                        db.set(cacheKey, obj),
                        db.set("localDataChanged:" + location.uuid, false)
                    ])
                }
                catch(e){
                    return reject(e)
                }

                return resolve({
                    changed: true,
                    data: obj
                })
            })
        }).catch(reject)
    })
}

export const readChunk = (path: string, offset: number, length: number): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        path = pathModule.normalize(path)

        let currentTries = 0
        let lastErr: any = undefined

        const req = (): any => {
            if(currentTries > FS_RETRIES){
                return reject(lastErr)
            }

            currentTries += 1

            fs.open(path, "r", (err: any, fd: any) => {
                if(err){
                    lastErr = err
            
                    if(FS_RETRY_CODES.includes(err.code)){
                        return setTimeout(req, FS_RETRY_TIMEOUT)
                    }
                    
                    return reject(err)
                }
    
                const buffer = Buffer.alloc(length)
    
                fs.read(fd, buffer, 0, length, offset, (err: any, read: any) => {
                    if(err){
                        lastErr = err
            
                        if(FS_RETRY_CODES.includes(err.code)){
                            return setTimeout(req, FS_RETRY_TIMEOUT)
                        }
                        
                        return reject(err)
                    }
    
                    let data: any = undefined
    
                    if(read < length){
                        data = buffer.slice(0, read)
                    }
                    else{
                        data = buffer
                    }
    
                    fs.close(fd, (err: any) => {
                        if(err){
                            lastErr = err
            
                            if(FS_RETRY_CODES.includes(err.code)){
                                return setTimeout(req, FS_RETRY_TIMEOUT)
                            }
                            
                            return reject(err)
                        }
    
                        return resolve(data)
                    })
                })
            })
        }

        return req()
    })
}

export const rm = async (path: string, location: Location): Promise<boolean> => {
    path = pathModule.normalize(path)

    const trashDirPath = pathModule.normalize(pathModule.join(location.local, ".filen.trash.local"))
    const basename = pathModule.basename(path)

    if(!(await doesExistLocally(path))){
        memoryCache.delete("gracefulLStat:" + path)

        return true
    }

    await fs.ensureDir(trashDirPath)
    
    try{
        await move(path, pathModule.normalize(pathModule.join(trashDirPath, basename)))
    }
    catch(e: any){
        if(e.code && e.code == "ENOENT"){
            memoryCache.delete("gracefulLStat:" + path)

            return true
        }

        throw e
    }

    memoryCache.delete("gracefulLStat:" + path)

    return true
}

export const rmPermanent = (path: string): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
        path = normalizePath(path)

        if(!(await doesExistLocally(path))){
            memoryCache.delete("gracefulLStat:" + pathModule.normalize(path))

            return resolve(true)
        }

        try{
            var stats = await gracefulLStat(path)
        }
        catch(e: any){
            if(e.code && e.code == "ENOENT"){
                memoryCache.delete("gracefulLStat:" + pathModule.normalize(path))

                return resolve(true)
            }

            return reject(e)
        }

        let currentTries = 0
        let lastErr: any = undefined

        const req = async (): Promise<any> => {
            if(currentTries > FS_RETRIES){
                return reject(lastErr)
            }

            currentTries += 1
        
            if(stats.isSymbolicLink()){
                try{
                    await fs.unlink(path)

                    memoryCache.delete("gracefulLStat:" + pathModule.normalize(path))
                }
                catch(e: any){
                    lastErr = e

                    if(e.code == "ENOENT"){
                        memoryCache.delete("gracefulLStat:" + pathModule.normalize(path))

                        return resolve(true)
                    }

                    if(FS_RETRY_CODES.includes(e.code)){
                        return setTimeout(req, FS_RETRY_TIMEOUT)
                    }
                    
                    return reject(e)
                }
            }
            else{
                try{
                    await fs.remove(path)

                    memoryCache.delete("gracefulLStat:" + pathModule.normalize(path))
                }
                catch(e: any){
                    lastErr = e

                    if(e.code == "ENOENT"){
                        memoryCache.delete("gracefulLStat:" + pathModule.normalize(path))

                        return resolve(true)
                    }

                    if(FS_RETRY_CODES.includes(e.code)){
                        return setTimeout(req, FS_RETRY_TIMEOUT)
                    }
                    
                    return reject(e)
                }
            }
    
            return resolve(true)
        }

        return req()
    })
}

export const mkdir = (path: string, location: any, task: any): Promise<any> => {
    return new Promise((resolve, reject) => {
        const absolutePath = normalizePath(pathModule.join(location.local, path))
        let currentTries = 0
        let lastErr: any = undefined

        const req = () => {
            if(currentTries > FS_RETRIES){
                return reject(lastErr)
            }

            currentTries += 1

            fs.ensureDir(absolutePath).then(() => {
                gracefulLStat(absolutePath).then(resolve).catch((err: any) => {
                    lastErr = err
    
                    if(FS_RETRY_CODES.includes(err.code)){
                        return setTimeout(req, FS_RETRY_TIMEOUT)
                    }

                    return reject(err)
                })
            }).catch((err: any) => {
                lastErr = err

                if(FS_RETRY_CODES.includes(err.code)){
                    return setTimeout(req, FS_RETRY_TIMEOUT)
                }
                
                return reject(err)
            })
        }

        return req()
    })
}

export const download = (path: string, location: any, task: any): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        await new Promise((resolve) => {
            const getPausedStatus = () => {
                Promise.all([
                    db.get("paused"),
                    isSyncLocationPaused(location.uuid)
                ]).then(([paused, locationPaused]) => {
                    if(paused || locationPaused){
                        return setTimeout(getPausedStatus, 1000)
                    }

                    return resolve(true)
                }).catch((err) => {
                    log.error(err)

                    return setTimeout(getPausedStatus, 1000)
                })
            }

            return getPausedStatus()
        })

        try{
            var absolutePath = normalizePath(pathModule.join(location.local, path))
            var file = task.item
        }
        catch(e){
            return reject(e)
        }

        getTempDir().then((tmpDir) => {
            try{
                var fileTmpPath = normalizePath(pathModule.join(tmpDir, uuidv4()))
            }
            catch(e){
                return reject(e)
            }

            Promise.all([
                rmPermanent(absolutePath),
                rmPermanent(fileTmpPath)
            ]).then(async () => {
                try{
                    var stream = fs.createWriteStream(fileTmpPath)
                }
                catch(e){
                    return reject(e)
                }

                const fileChunks = file.chunks
                let currentWriteIndex = 0

                const downloadTask = (index: number): Promise<{ index: number, data: Buffer }> => {
                    return new Promise((resolve, reject) => {
                        downloadChunk({ 
                            region: file.region,
                            bucket: file.bucket,
                            uuid: file.uuid,
                            index,
                            from: "sync",
                            location
                        }).then((data) => {
                            decryptData(data, file.metadata.key, file.version).then((decrypted) => {
                                return resolve({
                                    index,
                                    data: Buffer.from(decrypted)
                                })
                            }).catch(reject)
                        }).catch(reject)
                    })
                }

                const writeChunk = (index: number, data: Buffer) => {
                    if(index !== currentWriteIndex){
                        return setTimeout(() => {
                            writeChunk(index, data)
                        }, 10)
                    }

                    stream.write(data, (err: any) => {
                        if(err){
                            return reject(err)
                        }

                        currentWriteIndex += 1

                        return true
                    })
                }

                try{
                    await new Promise((resolve, reject) => {
                        let done = 0

                        for(let i = 0; i < fileChunks; i++){
                            downloadThreadsSemaphore.acquire().then(() => {
                                downloadTask(i).then(({ index, data }) => {
                                    writeChunk(index, data)

                                    done += 1

                                    downloadThreadsSemaphore.release()

                                    if(done >= fileChunks){
                                        return resolve(true)
                                    }
                                }).catch((err) => {
                                    downloadThreadsSemaphore.release()

                                    return reject(err)
                                })
                            })
                        }
                    })

                    await new Promise((resolve) => {
                        if(currentWriteIndex >= fileChunks){
                            return resolve(true)
                        }

                        const wait = setInterval(() => {
                            if(currentWriteIndex >= fileChunks){
                                clearInterval(wait)

                                return resolve(true)
                            }
                        }, 10)
                    })

                    await new Promise((resolve, reject) => {
                        stream.close((err: any) => {
                            if(err){
                                return reject(err)
                            }

                            return resolve(true)
                        })
                    })
                }
                catch(e){
                    fs.unlink(fileTmpPath, () => {})

                    return reject(e)
                }

                const now = new Date().getTime()
                const lastModified = convertTimestampToMs(typeof file.metadata.lastModified == "number" ? file.metadata.lastModified : now)
                const utimesLastModified = typeof lastModified == "number" && lastModified > 0 && now > lastModified ? lastModified : (now - 60000)

                move(fileTmpPath, absolutePath).then(() => {
                    fs.utimes(absolutePath, new Date(utimesLastModified), new Date(utimesLastModified)).then(() => {
                        checkLastModified(absolutePath).then(() => {
                            gracefulLStat(absolutePath).then((stat: any) => {
                                if(stat.size <= 0){
                                    rmPermanent(absolutePath)
            
                                    return reject(new Error(absolutePath + " size = " + stat.size))
                                }
                                
                                return resolve(stat)
                            }).catch(reject)
                        }).catch(reject)
                    }).catch(reject)
                }).catch(reject)
            }).catch(reject)
        }).catch(reject)
    })
}

export const move = (before: string, after: string, overwrite: boolean = true): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
        try{
            before = normalizePath(before)
            after = normalizePath(after)
        }
        catch(e){
            return reject(e)
        }

        if(!(await doesExistLocally(before))){
            return resolve(true)
        }

        let currentTries = 0
        let lastErr: any = undefined

        const req = () => {
            if(currentTries > FS_RETRIES){
                return reject(lastErr)
            }

            currentTries += 1

            fs.move(before, after, {
                overwrite
            }).then(resolve).catch((err: any) => {
                lastErr = err

                if(FS_RETRY_CODES.includes(err.code)){
                    return setTimeout(req, FS_RETRY_TIMEOUT)
                }
                
                return reject(err)
            })
        }

        return req()
    })
}

export const rename = (before: string, after: string): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
        try{
            before = normalizePath(before)
            after = normalizePath(after)
        }
        catch(e){
            return reject(e)
        }

        if(!(await doesExistLocally(before))){
            return resolve(true)
        }

        let currentTries = 0
        let lastErr: any = undefined

        const req = () => {
            if(currentTries > FS_RETRIES){
                return reject(lastErr)
            }

            currentTries += 1

            fs.rename(before, after).then(resolve).catch((err: any) => {
                lastErr = err

                if(FS_RETRY_CODES.includes(err.code)){
                    return setTimeout(req, FS_RETRY_TIMEOUT)
                }

                return reject(err)
            })
        }

        return req()
    })
}

export const createLocalTrashDirs = async (): Promise<boolean> => {
    const userId: number | null = await db.get("userId")

    if(!userId || !Number.isInteger(userId)){
        return true
    }

    const syncLocations: Location[] | null = await db.get("syncLocations:" + userId)

    if(!syncLocations || !Array.isArray(syncLocations)){
        return true
    }

    await Promise.all([
        ...syncLocations.map(location => fs.ensureDir(pathModule.normalize(pathModule.join(location.local, ".filen.trash.local"))))
    ])

    return true
}

export const clearLocalTrashDirs = (clearNow: boolean = false): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        db.get("userId").then((userId) => {
            if(!userId || !Number.isInteger(userId)){
                return
            }
    
            Promise.all([
                db.get("syncLocations:" + userId),
                createLocalTrashDirs()
            ]).then(([syncLocations, _]: [Location[] | null, any]) => {
                if(!syncLocations || !Array.isArray(syncLocations)){
                    return
                }
        
                Promise.allSettled([
                    ...syncLocations.map(location => new Promise((resolve, reject) => {
                        const path = pathModule.normalize(pathModule.join(location.local, ".filen.trash.local"))
        
                        const dirStream = readdirp(path, {
                            alwaysStat: false,
                            lstat: false,
                            type: "all",
                            depth: 2147483648
                        })
        
                        let statting = 0
                        const pathsToTrash: string[] = []
                        const now = new Date().getTime()
                        let dirSize = 0
                        
                        dirStream.on("data", async (item: { fullPath: string, stats: Stats }) => {
                            statting += 1
            
                            if(clearNow){
                                pathsToTrash.push(item.fullPath)
                            }
                            else{
                                try{
                                    item.stats = await gracefulLStat(item.fullPath)
            
                                    if(!item.stats.isSymbolicLink()){
                                        if((item.stats.ctimeMs + constants.deleteFromLocalTrashAfter) <= now){
                                            pathsToTrash.push(item.fullPath)
                                        }
            
                                        dirSize += item.stats.size
                                    }
                                }
                                catch(e){
                                    log.error(e)
                                }
                            }
            
                            statting -= 1
                        })
                        
                        dirStream.on("warn", (warn: any) => {
                            log.error("[Local trash] Readdirp warning:", warn)
                        })
                        
                        dirStream.on("error", (err: Error) => {
                            dirStream.destroy()
            
                            statting = 0
                            
                            return reject(err)
                        })
                        
                        dirStream.on("end", async () => {
                            await new Promise((resolve) => {
                                if(statting <= 0){
                                    return resolve(true)
                                }
            
                                const wait = setInterval(() => {
                                    if(statting <= 0){
                                        clearInterval(wait)
            
                                        return resolve(true)
                                    }
                                }, 10)
                            })
            
                            statting = 0
            
                            dirStream.destroy()
    
                            await Promise.allSettled([
                                db.set("localTrashDirSize:" + location.uuid, clearNow ? 0 : dirSize),
                                ...pathsToTrash.map(pathToTrash => rmPermanent(pathToTrash))
                            ])
    
                            return resolve(true)
                        })
                    }))
                ]).then(() => {
                    return resolve(true)
                })
            }).catch(reject)
        }).catch(reject)
    })
}

export const initLocalTrashDirs = () => {
    clearLocalTrashDirs().catch(log.error)

    clearInterval(LOCAL_TRASH_DIRS_CLEAN_INTERVAL)

    LOCAL_TRASH_DIRS_CLEAN_INTERVAL = setInterval(() => {
        clearLocalTrashDirs().catch(log.error)
    }, constants.clearLocalTrashDirsInterval)
}