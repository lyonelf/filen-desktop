const fr: {
    [key: string]: string
} = {
    loginEmailPlaceholder: "Adresse e-mail",
    loginPasswordPlaceholder: "Mot de passe",
    loginTwoFactorCodePlaceholder: "Code de double authentification",
    loginBtn: "Connexion",
    titlebarLogin: "Se connecter",
    loginInvalidFields: "Champs invalides",
    loginInvalidEmail: "Adresse e-mail invalide",
    loginInvalidEmailOrPassword: "Adresse e-mail ou mot de passe invalide",
    loginAccountNotYetActivated: "Compte pas encore activé",
    loginWrongEmailOrPassword: "Adresse e-mail ou mot de passe incorrect",
    invalidTwoFactorKey: "Code de double authentification incorrect",
    titlebarMain: "Filen",
    titlebarSettings: "Paramètres",
    titlebarSelectFolderRemote: "Sélectionnez un dossier distant",
    titlebarDownload: "Télécharger",
    titlebarCloud: "Cloud",
    titlebarUpload: "Charger",
    titlebarSelectiveSync: "Synchronisation sélective",
    close: "Fermer",
    save: "Enregistrer",
    syncingItemsFooterSingular: "Synchronisation de __COUNT__ élément",
    syncingItemsFooterPlural: "Synchronisation de __COUNT__ éléments",
    syncingFooterEverythingSynced: "Tout est à jour !",
    aboutRemaining: "Environ __TIME__ restantes",
    noSyncActivityYet: "Aucune activité",
    createOne: "Créer",
    noSyncLocationsSetupYet: "Aucun emplacement de synchronisation n'a encore été configuré",
    storageUsed: "__USED__ utilisé(s) sur __MAX__",
    quitFilen: "Quitter Filen",
    openWebsite: "Ouvrir la version web",
    settings: "Paramètres",
    actions: "Actions",
    youAreOffline: "Vous êtes hors-ligne",
    forgotPasswordBtn: "Mot de passe oublié",
    createAccountBtn: "Créer un compte",
    select: "Sélectionner",
    thisFolderIsEmpty: "Dossier vide",
    createFolder: "Créer un dossier",
    create: "Créer",
    downloadDone: "Téléchargement terminé",
    openFolder: "Ouvrir le dossier",
    download: "Télécharger",
    change: "Modifier",
    open: "Ouvrir",
    noFilesOrFoldersUploadedYet: "Aucun fichier ou dossier chargé pour l'instant",
    uploadDone: "Chargement effectuée",
    preparingUpload: "Préparation...",
    preparingUploadFolders: "Création de la structure des dossiers...",
    launchAtSystemStartup: "Lancer au démarrage du système",
    darkMode: "Mode sombre",
    excludeDot: "Exclure les fichiers et dossiers commençant par un point (recommandé)",
    excludeDotTooltip: "Exclut les fichiers et dossiers dont le nom commence par un point, par exemple \".gitignore, .DS_Store\"",
    language: "Langue",
    saveLogs: "Enregistrer les logs",
    cannotCreateSyncLocation: "Impossible de créer un emplacement de synchronisation",
    cannotCreateSyncLocationSubdir: "Vous devez sélectionner au moins un sous-dossier",
    cannotCreateSyncLocationLoop: "L'emplacement local sélectionné est déjà un emplacement de synchronisation configuré. Cela pourrait amener à des boucles de synchronisation sans fin",
    cannotCreateSyncLocationAccess: "Impossible d'accéder au dossier local. Assurez-vous d'avoir les permissions requises",
    selectRemoteLocation: "Sélectionner un emplacement distant",
    syncMode: "Mode de synchronisation",
    syncModeTwoWay: "Bidirectionnel",
    syncModeLocalToCloud: "Local vers Cloud",
    syncModeCloudToLocal: "Cloud vers Local",
    syncModeLocalBackup: "Sauvegarde locale",
    syncModeCloudBackup: "Sauvegarde Cloud",
    selectiveSync: "Synchronisation sélective",
    selectiveSyncTooltip: "Sélectionnez quels fichiers et dossiers vous souhaitez synchroniser localement",
    configure: "Configurer",
    filenignoreTooltip: "Exclut les chemins et les correspondances de structure de la synchronisation. Fonctionne comme un fichier .gitignore",
    edit: "Éditer",
    paused: "En pause",
    deleteSyncLocation: "Supprimer l'emplacement de synchronisation",
    confirmDeleteSyncLocation: "Voulez-vous vraiment supprimer cet emplacement de synchronisation ?",
    delete: "Supprimer",
    filenignoreHeader: "Structures ignorées, séparées par un retour à la ligne",
    accountStorageUsed: "__PERCENT__% utilisés sur __MAX__",
    logout: "Se déconnecter",
    accountCurrentPlan: "Offre actuelle",
    accountUpgrade: "Mettre à niveau",
    accountStorageInUse: "__PERCENT__% utilisés",
    confirmLogout: "Voulez-vous vraiment vous déconnecter ?",
    resumeSyncing: "Reprendre la synchronisation",
    noSyncIssues: "Aucun problème de synchronisation",
    clearSyncIssues: "Vider le journal d'erreurs",
    clearSyncIssuesInfo: "En effaçant les erreurs affichées, le client essaiera à nouveau de relancer la synchronisation. Merci de corriger toutes les erreurs avant de les effacer.",
    clear: "Effacer",
    uploadBandwidthThrottling: "Limitation de la bande passante de chargement",
    unlimited: "illimité",
    downloadBandwidthThrottling: "Limitation de la bande passante de téléchargement",
    networkThrottling: "Restrictions réseau",
    maximumUploadBandwidth: "Bande passante maximale de chargement (en Kbps)",
    maximumDownloadBandwidth: "Bande passante maximale de téléchargement (en Kbps)",
    disableThrottlingInfo: "Mettre une valeur à 0 désactivera la limitation",
    resetToDefaults: "Restaurer les valeurs par défaut",
    changeKeybind: "Modifier les raccourcis clavier",
    pressKeyOrCombo: "Appuyez sur n'importe quelle touche ou combinaison de touches",
    settingsGeneral: "Général",
    settingsSyncs: "Synchros",
    settingsAccount: "Compte",
    settingsIssues: "Erreurs",
    settingsNetworking: "Réseau",
    settingsKeybinds: "Raccourcis clavier",
    createFolderPlaceholder: "Nouveau dossier",
    invalidFolderName: "Nom de dossier invalide",
    titlebarCloudWindow: "Cloud",
    updateAvailable: "Une mise à jour est disponible, veillez à télécharger la dernière version pour des corrections de bugs et des améliorations de performances",
    downloadUpdateBtn: "Télécharger la mise à jour",
    pause: "Suspendre",
    resume: "Reprendre",
    keybinds_uploadFolders: "Charger des dossiers",
    keybinds_uploadFiles: "Charger des fichiers",
    keybinds_openSettings: "Ouvrir les paramètres",
    keybinds_pauseSync: "Suspendre la synchronisation",
    keybinds_resumeSync: "Reprendre la synchronisation",
    keybinds_openWebsite: "Ouvrir la version web",
    keybindNotBound: "Non défini",
    syncing: "Synchronisation...",
    maxStorageReached: "Vous avez atteint le volume de stockage maximal de votre compte. Afin de pouvoir continuer à synchroniser vos documents, nous vous recommandons de mettre à niveau votre offre de stockage.",
    syncTaskDownloadFromRemote: "Téléchargé depuis le cloud",
    syncTaskUploadToRemote: "Chargé dans le cloud",
    syncTaskRenameInRemote: "Renommé dans le cloud",
    syncTaskRenameInLocal: "Renommé localement",
    syncTaskMoveInRemote: "Déplacé dans le cloud",
    syncTaskMoveInLocal: "Déplacé localement",
    syncTaskDeleteInRemote: "Supprimé dans le cloud",
    syncTaskDeleteInLocal: "Supprimé localement",
    queued: "En attente",
    acquiringSyncLock: "Acquisition du verrou de synchronisation...",
    syncLocationCreated: "Emplacement de synchronisation créé. Pour commencer la synchronisation, veuillez lui désactiver le mode pause.",
    checkingChanges: "Vérification des changements...",
    syncModeTwoWayInfo: "Reflète chaque action dans les deux directions",
    syncModeLocalToCloudInfo: "Reflète chaque action locale dans le cloud mais ne prend pas en compte les changements distants",
    syncModeCloudToLocalInfo: "Reflète chaque action effectuée dans le cloud mais ne prend pas en compte les changements locaux",
    syncModeLocalBackupInfo: "Charge seulement les données dans le cloud, ne supprime jamais rien ni ne prend en compte les changements distants",
    syncModeCloudBackupInfo: "Télécharge seulement les données depuis le cloud, ne supprime jamais rien ni ne prend en compte les changements locaux",
    cancel: "Annuler",
    cannotCreateSyncLocationLoop2: "L'emplacement distant sélectionné est déjà un emplacement de synchronisation configuré. Cela pourrait amener à des boucles de synchronisation sans fin"
}

export default fr
