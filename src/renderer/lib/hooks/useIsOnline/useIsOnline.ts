import { useEffect, useState } from "react"
import useDb from "../useDb"

const useIsOnline = (): boolean => {
    const [data, setData] = useState<boolean>(true)
	const isOnline: boolean = useDb("isOnline", true)

	useEffect(() => {
		setData(typeof isOnline == "boolean" && isOnline !== null ? isOnline : true)
	}, [isOnline])

	return data
}

export default useIsOnline