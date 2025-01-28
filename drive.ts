import { CLIENT_ID, API_KEY } from './config.js';

const DISCOVERY_DOC = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let tokenClient: TokenClient;
let gapiInited: boolean = false;
let gisInited: boolean = false;

// Helper function to safely get HTML elements
function getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element with id '${id}' not found`);
    }
    return element;
}

async function listDriveFiles(): Promise<void> {
    try {
        const response = await gapi.client.drive.files.list({
            'pageSize': 100,
            'fields': 'files(id, name, mimeType, modifiedTime)',
            'orderBy': 'modifiedTime desc'
        });

        const filesList = getElement('files-list');
        const files = response.result.files;

        if (!files || files.length === 0) {
            filesList.innerHTML = 'No files found.';
            return;
        }

        filesList.innerHTML = '';
        for (const file of files) {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = `https://drive.google.com/file/d/${file.id}/view`;
            link.target = '_blank';
            link.textContent = `${file.name} (${file.mimeType})`;
            
            const date = new Date(file.modifiedTime);
            const dateSpan = document.createElement('span');
            dateSpan.textContent = ` - Last modified: ${date.toLocaleDateString()}`;
            
            li.appendChild(link);
            li.appendChild(dateSpan);
            filesList.appendChild(li);
        }
    } catch (error) {
        console.error('Error listing files:', error);
        getElement('files-list').innerHTML = 'Error loading files.';
    }
}

// Auth functions (similar to your existing ones)
function handleAuthClick(): void {
    tokenClient.callback = async (resp: TokenResponse): Promise<void> => {
        if (resp.error !== undefined) {
            throw new Error(`Authentication error: ${resp.error}`);
        }
        try {
            getElement('signout_button').style.display = 'block';
            getElement('authorize_button').style.display = 'none';
            getElement('content').style.display = 'block';
            await listDriveFiles();
        } catch (error) {
            console.error('Error handling authentication:', error);
        }
    };

    try {
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    } catch (error) {
        console.error('Error requesting access token:', error);
    }
}

function handleSignoutClick(): void {
    const token = gapi.client.getToken();
    if (token !== null) {
        try {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            getElement('content').style.display = 'none';
            getElement('authorize_button').style.display = 'block';
            getElement('signout_button').style.display = 'none';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
}

async function initializeGapiClient(): Promise<void> {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOC,
        });
        gapiInited = true;
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing GAPI client:', error);
    }
}

function maybeEnableButtons(): void {
    if (gapiInited && gisInited) {
        getElement('authorize_button').style.display = 'block';
    }
}

// Export the functions before assigning to window
export function gapiLoaded(): void {
    gapi.load('client', initializeGapiClient);
}

export function gisLoaded(): void {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing token client:', error);
    }
}

// Assign to window after export
(window as any).gapiLoaded = gapiLoaded;
(window as any).gisLoaded = gisLoaded;
(window as any).handleAuthClick = handleAuthClick;
(window as any).handleSignoutClick = handleSignoutClick; 