declare var gapi: {
    load: (api: string, callback: () => void) => void;
    client: {
        init: (config: any) => Promise<void>;
        getToken: () => { access_token: string } | null;
        setToken: (token: string) => void;
        people: {
            people: {
                connections: {
                    list: (params: any) => Promise<any>;
                }
            }
        },
        drive: {
            files: {
                list: (params: any) => Promise<any>;
                get: (params: any) => Promise<any>;
            }
        }
    }
};

declare var google: {
    accounts: {
        oauth2: {
            initTokenClient: (config: {
                client_id: string;
                scope: string;
                callback: string | ((resp: any) => void);
            }) => any;
            revoke: (token: string) => void;
        }
    }
};

// Add window properties
interface Window {
    gapiLoaded: () => void;
    gisLoaded: () => void;
    handleAuthClick: () => void;
    handleSignoutClick: () => void;
}

interface TokenClient {
    callback: (response: TokenResponse) => void;
    requestAccessToken: (config: { prompt: string }) => void;
}

interface TokenResponse {
    error?: string;
    access_token?: string;
} 