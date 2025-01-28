import { CLIENT_ID, API_KEY } from './config.js';

// Type definitions for Google API responses and objects
interface GooglePerson {
    names?: {
        displayName: string;
    }[];
}

interface GoogleResponse {
    result: {
        connections?: GooglePerson[];
    };
}

interface TokenResponse {
    error?: string;
    access_token?: string;
}

interface TokenClient {
    callback: (response: TokenResponse) => void;
    requestAccessToken: (config: { prompt: string }) => void;
}

const DISCOVERY_DOC = [
    'https://www.googleapis.com/discovery/v1/apis/people/v1/rest',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/drive.readonly';

let tokenClient: TokenClient;
let gapiInited: boolean = false;
let gisInited: boolean = false;
let contacts: string[] = []; // Store contacts for filtering

// Helper function to safely get HTML elements
function getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element with id '${id}' not found`);
    }
    return element;
}

function handleAuthClick(): void {
    tokenClient.callback = async (resp: TokenResponse): Promise<void> => {
        if (resp.error !== undefined) {
            throw new Error(`Authentication error: ${resp.error}`);
        }
        try {
            const signoutButton = getElement('signout_button');
            const authorizeButton = getElement('authorize_button');
            const content = getElement('content');
            
            signoutButton.style.display = 'block';
            authorizeButton.style.display = 'none';
            content.style.display = 'block';
            
            await listConnectionNames();
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
            
            const content = getElement('content');
            const authorizeButton = getElement('authorize_button');
            const signoutButton = getElement('signout_button');
            
            content.style.display = 'none';
            authorizeButton.style.display = 'block';
            signoutButton.style.display = 'none';
            contacts = []; // Clear contacts on sign out
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
        try {
            getElement('authorize_button').style.display = 'block';
        } catch (error) {
            console.error('Error showing authorize button:', error);
        }
    }
}

function displayContacts(filteredContacts: string[] = contacts): void {
    const contactsList = getElement('contacts-list');
    contactsList.innerHTML = '';
    
    // Add a count of displayed contacts
    const countDiv = document.createElement('div');
    countDiv.style.textAlign = 'center';
    countDiv.style.margin = '10px 0';
    countDiv.style.color = '#666';
    countDiv.textContent = `Showing ${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''}`;
    contactsList.parentElement?.insertBefore(countDiv, contactsList);
    
    filteredContacts.forEach(name => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `chat.html?name=${encodeURIComponent(name)}`;
        link.textContent = name;
        li.appendChild(link);
        contactsList.appendChild(li);
    });
}

function filterContacts(): void {
    const searchInput = (document.getElementById('search-input') as HTMLInputElement).value.toLowerCase();
    const filteredContacts = contacts.filter(name => 
        name.toLowerCase().includes(searchInput)
    );
    displayContacts(filteredContacts);
}

async function listConnectionNames(): Promise<void> {
    try {
        const response: GoogleResponse = await gapi.client.people.people.connections.list({
            'resourceName': 'people/me',
            'pageSize': 100,
            'personFields': 'names',
        });

        const connections = response.result.connections;

        if (!connections || connections.length === 0) {
            getElement('contacts-list').innerHTML = 'No contacts found.';
            return;
        }

        // Store and sort contacts alphabetically
        contacts = connections
            .filter(person => person.names?.[0]?.displayName)
            .map(person => person.names![0].displayName)
            .sort((a, b) => a.localeCompare(b));

        displayContacts();
    } catch (error) {
        console.error('Error listing connections:', error);
        getElement('contacts-list').innerHTML = 'Error loading contacts.';
    }
}

async function findAndReadDriveFile(name: string): Promise<string> {
    try {
        console.log('Searching for file:', name);
        const searchResponse = await gapi.client.drive.files.list({
            q: `name = '${name}.txt' and mimeType = 'text/plain'`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = searchResponse.result.files;
        if (!files || files.length === 0) {
            return '';
        }

        // Get the first matching file
        const fileId = files[0].id;
        const fileResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        // Use JSZip to extract the text file
        // const zip = new JSZip();
        // const zipContent = await zip.loadAsync(fileResponse.body);
        // const txtFile = zipContent.file(`${name}.txt`);
        
        // if (!txtFile) {
        //     return 'No text file found in zip';
        // }

        // const content = await txtFile.async('string');
        // return content;

        // Return the content directly since it's already a text file
        return fileResponse.body;
    } catch (error) {
        console.error('Error reading Drive file:', error);
        return '';
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

// Assign to window after export3
Object.assign(window, {
    gapiLoaded,
    gisLoaded,
    handleAuthClick,
    handleSignoutClick,
    filterContacts: filterContacts
});

// Remove the import and declare JSZip globally
declare const JSZip: any; 