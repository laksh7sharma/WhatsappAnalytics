import { CLIENT_ID, API_KEY } from './config.js';
declare const Chart: any;

const DISCOVERY_DOC = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

interface ChatMessage {
    date: string;
    time: string;
    sender: string;
    text: string;
}

interface MessageCount {
    date: string;
    [sender: string]: number | string;
}

interface TimeSlot {
    name: string;
    startHour: number;
    endHour: number;
}

interface ChartArea {
    width: number;
    height: number;
}

interface ChartParam {
    chart: {
        chartArea?: ChartArea;
    };
}

const timeSlots: TimeSlot[] = [
    { name: 'Morning', startHour: 5, endHour: 11 },
    { name: 'Afternoon', startHour: 12, endHour: 16 },
    { name: 'Evening', startHour: 17, endHour: 21 },
    { name: 'Night', startHour: 22, endHour: 4 }  // 28 represents next day 4am
];

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let tokenClient: any;

interface ChartContext {
    dataset: {
        data: Array<{x: number, y: number, v: number}>
    };
    dataIndex: number;
}

interface SentimentCounts {
    highlyPositive: number;
    positive: number;
    neutral: number;
    negative: number;
    highlyNegative: number;
}

// Remove AFINN declaration and add our own sentiment dictionary
const SENTIMENT_DICT: { [key: string]: number } = {
    // Very positive emotions/words (2.5-3.5)
    'love': 3.5, 'perfect': 3.2, '❤️': 3.2, '😍': 3.1,
    
    // Positive emotions/words (1.5-2.4)
    'awesome': 2.4, 'amazing': 2.3, 'fantastic': 2.3, '😄': 2.3,
    'excellent': 2.2, 'wonderful': 2.2, '😃': 2.2, '😊': 2.1,
    'best': 2.0, 'happy': 2.0, 'yay': 1.9, 'wow': 1.8,
    'glad': 1.6, 'great': 1.5,
    
    // Slightly positive (0.1-1.4)
    'good': 1.4, 'cool': 1.3, 'haha': 1.2, 'nice': 1.1,
    'lol': 1.0, 'yes': 0.8, 'thanks': 0.7, 'thank': 0.7,
    'please': 0.5,
    
    // Slightly negative (-0.1 to -1.4)
    'no': -0.5, 'sorry': -0.8, 'sad': -0.9,
    'poor': -1.0, 'bad': -1.2, '😞': -1.3,
    
    // Negative (-1.5 to -2.4)
    'waste': -1.8, 'upset': -1.9, 'angry': -2.0,
    'disappointed': -2.1, '😢': -2.2, 'stupid': -2.3,
    
    // Very negative (-2.5 to -3.5)
    'horrible': -2.5, 'awful': -2.6, 'terrible': -2.8,
    '😭': -2.9, '😠': -3.0, '😡': -3.2, 'hate': -3.5
};

function parseWhatsAppChat(chatText: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    // Simpler regex pattern
    const messageRegex = /(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{1,2}) - ([^:]+): ([^\d]+)/g;
    
    // Debug the input
    console.log('First 100 chars:', chatText.substring(0, 100));
    console.log('Is string?', typeof chatText === 'string');
    console.log('Length:', chatText.length);
    
    // Try to match just the first date/time pattern
    const firstMatch = chatText.match(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{1,2}/);
    console.log('First date/time found:', firstMatch);

    let match;
    while ((match = messageRegex.exec(chatText)) !== null) {
        console.log('Found match:', match);
        messages.push({
            date: match[1],
            time: match[2],
            sender: match[3].trim(),
            text: match[4].trim()
        });
    }

    console.log(`Found ${messages.length} messages`);
    if (messages.length > 0) {
        console.log('First message:', messages[0]);
    }
    
    return messages;
}

function displayMessages(messages: ChatMessage[]): void {
    // Remove old chart if it exists
    const oldCanvas = document.getElementById('messageChart');
    if (oldCanvas) {
        oldCanvas.remove();
    }

    // Create new canvas
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'messageChart';
    chartContainer.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        console.error('Could not get canvas context');
        return;
    }

    // Group messages by date and sender
    const messagesByDate = new Map<string, Map<string, number>>();
    const senders = new Set<string>();

    messages.forEach(msg => {
        senders.add(msg.sender);
        if (!messagesByDate.has(msg.date)) {
            messagesByDate.set(msg.date, new Map<string, number>());
        }
        const dateMap = messagesByDate.get(msg.date)!;
        dateMap.set(msg.sender, (dateMap.get(msg.sender) || 0) + 1);
    });

    // Convert to array and sort by date chronologically
    const dates = Array.from(messagesByDate.keys()).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        
        // Compare years first
        if (yearA !== yearB) return yearA - yearB;
        // Then months
        if (monthA !== monthB) return monthA - monthB;
        // Finally days
        return dayA - dayB;
    });
    
    // Prepare data for Chart.js
    const datasets = Array.from(senders).map(sender => {
        const data = dates.map(date => 
            messagesByDate.get(date)?.get(sender) || 0
        );
        
        // Generate a random color for each sender
        const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        
        return {
            label: sender,
            data: data,
            borderColor: color,
            tension: 0.1,
            fill: false
        };
    });

    // Create the chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Messages',
                        font: {
                            size: 14
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15,
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Messages Over Time by Sender',
                    padding: {
                        top: 10,
                        bottom: 30
                    },
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        boxWidth: 12,
                        font: {
                            size: 12
                        }
                    }
                }
            },
            layout: {
                padding: {
                    left: 20,
                    right: 30,
                    top: 20,
                    bottom: 30
                }
            }
        }
    });

    // Set the canvas height explicitly after chart creation
    canvas.style.height = '500px';

    // Add time distribution pie chart
    createTimeDistribution(messages);
    
    // Add sentiment distribution pie chart
    createSentimentDistribution(messages);

    // Add message pattern analysis
    analyzeMessagePatterns(messages);

    // Add topic analysis
    analyzeTopics(messages);
}

function createTimeDistribution(messages: ChatMessage[]): void {
    // Create container
    const container = document.createElement('div');
    container.id = 'time-distribution-container';
    container.style.marginTop = '40px';
    document.getElementById('chart-container')?.appendChild(container);

    const canvas = document.createElement('canvas');
    canvas.id = 'timeDistributionChart';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        console.error('Could not get chart canvas context');
        return;
    }

    // Initialize counters for each time slot
    const timeDistribution = new Map<string, number>();
    timeSlots.forEach(slot => timeDistribution.set(slot.name, 0));

    // Count messages in each time slot
    messages.forEach(msg => {
        const [hours, minutes] = msg.time.split(':').map(Number);
        let adjustedHours = hours;
        if (hours < 4) adjustedHours += 24;  // Handle evening times after midnight

        // Find matching time slot
        for (const slot of timeSlots) {
            if (slot.name === 'Night') {
                if (hours >= 23 || hours < 4) {
                    timeDistribution.set(slot.name, timeDistribution.get(slot.name)! + 1);
                    break;
                }
            } else if (adjustedHours >= slot.startHour && adjustedHours < slot.endHour) {
                timeDistribution.set(slot.name, timeDistribution.get(slot.name)! + 1);
                break;
            }
        }
    });

    // Create pie chart
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: timeSlots.map(slot => {
                const startHour = slot.startHour % 24;  // Handle night hours
                const endHour = slot.endHour % 24;
                return `${slot.name} (${startHour}:00 - ${endHour}:00)`;
            }),
            datasets: [{
                data: Array.from(timeDistribution.values()),
                backgroundColor: [
                    'rgba(255, 206, 86, 0.8)',  // Morning - yellow
                    'rgba(54, 162, 235, 0.8)',  // Afternoon - blue
                    'rgba(255, 99, 132, 0.8)',  // Evening - red
                    'rgba(75, 192, 192, 0.8)'   // Night - green
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Message Distribution by Time of Day'
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} messages (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function analyzeSentiment(text: string): number {
    const words = text.toLowerCase().match(/\b[\w']+\b/g) || [];
    let totalScore = 0.0;
    let wordCount = 0.0;  // Make wordCount floating point

    // Check for emojis first (they're stronger indicators)
    const emojiRegex = /[^\u0000-\u007F]+/g;
    const emojis = text.match(emojiRegex) || [];
    emojis.forEach(emoji => {
        if (SENTIMENT_DICT.hasOwnProperty(emoji)) {
            totalScore += parseFloat((SENTIMENT_DICT[emoji] * 1.5).toFixed(2));
            wordCount += 1.0;
        }
    });

    // Create case-insensitive lookup object
    const sentimentLookup = Object.fromEntries(
        Object.entries(SENTIMENT_DICT).map(([key, value]) => [key.toLowerCase(), parseFloat(value.toString())])
    );

    // Then check words (now case insensitive)
    words.forEach(word => {
        const lowercaseWord = word.toLowerCase();
        if (sentimentLookup.hasOwnProperty(lowercaseWord)) {
            totalScore += parseFloat(sentimentLookup[lowercaseWord].toFixed(2));
            wordCount += 1.0;
        }
    });

    // If no sentiment words found, try to infer sentiment from message characteristics
    if (wordCount === 0) {
        if (text.includes('!')) totalScore += 0.3;
        if (text.includes('?')) totalScore -= 0.2;
        if (text.match(/[A-Z]{3,}/)) totalScore += 0.3;
        if (text.match(/[!?]{2,}/)) totalScore += 0.3;
        if (totalScore !== 0) wordCount = 1.0;
    }

    // Add detailed logging right before return
    console.log('Analyzing:', text);
    console.log('Total score:', totalScore.toFixed(2));
    console.log('Word count:', wordCount.toFixed(2));
    console.log('Final score:', (wordCount > 0 ? (totalScore / wordCount).toFixed(2) : '0.00'));
    console.log('-------------------');

    return wordCount > 0 ? parseFloat((totalScore / wordCount).toFixed(2)) : 0.0;
}

function createSentimentDistribution(messages: ChatMessage[]): void {
    const sentimentCounts: SentimentCounts = {
        highlyPositive: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        highlyNegative: 0
    };

    messages.forEach(msg => {
        const score = analyzeSentiment(msg.text);
        const neutralThreshold = 0.01;  // Much smaller neutral zone
        const extremeThreshold = 2.0;   // Lower threshold for extreme sentiments
        console.log('Message:', msg.text, 'Score:', score.toFixed(2));

        if (score >= extremeThreshold) sentimentCounts.highlyPositive++;
        else if (score >= neutralThreshold) sentimentCounts.positive++;
        else if (score > -neutralThreshold && score < neutralThreshold) sentimentCounts.neutral++;
        else if (score <= -extremeThreshold) sentimentCounts.highlyNegative++;
        else sentimentCounts.negative++;
    });

    // Create container
    const container = document.createElement('div');
    container.id = 'sentiment-distribution-container';
    container.style.marginTop = '40px';
    document.getElementById('chart-container')?.appendChild(container);

    const canvas = document.createElement('canvas');
    canvas.id = 'sentimentChart';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        console.error('Could not get sentiment chart context');
        return;
    }

    // Create pie chart
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [
                'Highly Positive',
                'Positive',
                'Neutral',
                'Negative',
                'Highly Negative'
            ],
            datasets: [{
                data: [
                    sentimentCounts.highlyPositive,
                    sentimentCounts.positive,
                    sentimentCounts.neutral,
                    sentimentCounts.negative,
                    sentimentCounts.highlyNegative
                ],
                backgroundColor: [
                    'rgba(0, 255, 0, 0.8)',    // Bright green
                    'rgba(144, 238, 144, 0.8)', // Light green
                    'rgba(200, 200, 200, 0.8)', // Gray
                    'rgba(255, 160, 122, 0.8)', // Light red
                    'rgba(255, 0, 0, 0.8)'      // Bright red
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Message Sentiment Distribution'
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} messages (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

interface PersonMetrics {
    reachOuts: number;
    doubleMessages: number;
    responseTimes: number[];  // in minutes
}

function analyzeMessagePatterns(messages: ChatMessage[]): void {
    const metrics = new Map<string, PersonMetrics>();
    
    // Initialize metrics for each person
    messages.forEach(msg => {
        if (!metrics.has(msg.sender)) {
            metrics.set(msg.sender, {
                reachOuts: 0,
                doubleMessages: 0,
                responseTimes: []
            });
        }
    });

    for (let i = 0; i < messages.length; i++) {
        const currentMsg = messages[i];
        const prevMsg = i > 0 ? messages[i-1] : null;

        // Calculate time difference in minutes between messages
        if (prevMsg) {
            // Parse date components
            const [prevDay, prevMonth, prevYear] = prevMsg.date.split('/').map(Number);
            const [prevHour, prevMin] = prevMsg.time.split(':').map(Number);
            const [currDay, currMonth, currYear] = currentMsg.date.split('/').map(Number);
            const [currHour, currMin] = currentMsg.time.split(':').map(Number);

            // Create Date objects with proper year (assuming 20xx)
            const prevTime = new Date(2000 + prevYear, prevMonth - 1, prevDay, prevHour, prevMin);
            const currTime = new Date(2000 + currYear, currMonth - 1, currDay, currHour, currMin);

            // Calculate difference in minutes
            const diffMinutes = (currTime.getTime() - prevTime.getTime()) / (1000 * 60);

            console.log('Previous:', prevMsg.date, prevMsg.time);
            console.log('Current:', currentMsg.date, currentMsg.time);
            console.log('Diff minutes:', diffMinutes);

            // Check for reach outs (12+ hours of silence)
            if (diffMinutes >= 720) {  // 12 hours = 360 minutes
                metrics.get(currentMsg.sender)!.reachOuts++;

            } else if (currentMsg.sender !== prevMsg.sender) { //these are mutually exclusive
                metrics.get(currentMsg.sender)!.responseTimes.push(diffMinutes);
            }

            // Check for double messages (same person, 10+ minutes apart)
            if (currentMsg.sender === prevMsg.sender && diffMinutes >= 10) {
                metrics.get(currentMsg.sender)!.doubleMessages++;
            }

            // Calculate response time (different people)
            // if (currentMsg.sender !== prevMsg.sender) {
            //     metrics.get(currentMsg.sender)!.responseTimes.push(diffMinutes);
            // }
        }
    }

    // Calculate and display metrics
    const container = document.createElement('div');
    container.id = 'message-patterns-container';
    container.style.marginTop = '40px';
    container.style.padding = '20px';
    container.style.backgroundColor = '#f5f5f5';
    container.style.borderRadius = '8px';
    document.getElementById('chart-container')?.appendChild(container);

    const title = document.createElement('h2');
    title.textContent = 'Message Pattern Analysis';
    title.style.marginBottom = '20px';
    container.appendChild(title);

    metrics.forEach((personMetrics, person) => {
        const personDiv = document.createElement('div');
        personDiv.style.marginBottom = '20px';
        
        // Calculate mean response time
        const mean = personMetrics.responseTimes.length > 0 
            ? personMetrics.responseTimes.reduce((a, b) => a + b, 0) / personMetrics.responseTimes.length 
            : 0;
        
        // Calculate median response time
        const sortedTimes = [...personMetrics.responseTimes].sort((a, b) => a - b);
        const median = sortedTimes.length > 0
            ? sortedTimes.length % 2 === 0
                ? (sortedTimes[sortedTimes.length/2 - 1] + sortedTimes[sortedTimes.length/2]) / 2
                : sortedTimes[Math.floor(sortedTimes.length/2)]
            : 0;

        personDiv.innerHTML = `
            <h3 style="color: #333;">${person}</h3>
            <p>Reach Outs: ${personMetrics.reachOuts}</p>
            <p>Double Messages: ${personMetrics.doubleMessages}</p>
            <p>Mean Response Time: ${mean.toFixed(1)} minutes</p>
            <p>Median Response Time: ${median.toFixed(1)} minutes</p>
        `;
        
        container.appendChild(personDiv);
    });
}

interface TopicMetrics {
    selfReferences: number;    // I, me, my, mine
    otherReferences: number;   // you, your, yours
    groupReferences: number;   // we, us, our
    thirdPartyReferences: number;  // he, she, they, them
    totalMessages: number;
}

function analyzeTopics(messages: ChatMessage[]): void {
    const topicsByPerson = new Map<string, TopicMetrics>();
    
    const pronouns = {
        self: new Set(['i', 'me', 'my', 'mine', 'myself']),
        other: new Set(['you', 'your', 'yours', 'yourself', 'u']),
        group: new Set(['we', 'us', 'our', 'ours', 'ourselves']),
        thirdParty: new Set(['he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'theirs'])
    };

    // Initialize metrics for each person
    messages.forEach(msg => {
        if (!topicsByPerson.has(msg.sender)) {
            topicsByPerson.set(msg.sender, {
                selfReferences: 0,
                otherReferences: 0,
                groupReferences: 0,
                thirdPartyReferences: 0,
                totalMessages: 0
            });
        }
    });

    // Analyze each message
    messages.forEach(msg => {
        const words = msg.text.toLowerCase().match(/\b\w+\b/g) || [];
        const metrics = topicsByPerson.get(msg.sender)!;
        
        metrics.totalMessages++;
        
        words.forEach(word => {
            if (pronouns.self.has(word)) metrics.selfReferences++;
            if (pronouns.other.has(word)) metrics.otherReferences++;
            if (pronouns.group.has(word)) metrics.groupReferences++;
            if (pronouns.thirdParty.has(word)) metrics.thirdPartyReferences++;
        });
    });

    // Create display container
    const container = document.createElement('div');
    container.id = 'topic-analysis-container';
    container.style.marginTop = '40px';
    container.style.padding = '20px';
    container.style.backgroundColor = '#f5f5f5';
    container.style.borderRadius = '8px';
    document.getElementById('chart-container')?.appendChild(container);

    const title = document.createElement('h2');
    title.textContent = 'Conversation Topic Analysis';
    title.style.marginBottom = '20px';
    container.appendChild(title);

    // Display metrics for each person
    topicsByPerson.forEach((metrics, person) => {
        const personDiv = document.createElement('div');
        personDiv.style.marginBottom = '30px';

        const total = metrics.totalMessages;
        
        // Calculate total references
        const totalReferences = metrics.selfReferences + metrics.otherReferences + metrics.groupReferences + metrics.thirdPartyReferences;

        // Calculate percentages based on total references
        const selfPercent = totalReferences > 0 ? ((metrics.selfReferences / totalReferences) * 100).toFixed(1) : '0.0';
        const otherPercent = totalReferences > 0 ? ((metrics.otherReferences / totalReferences) * 100).toFixed(1) : '0.0';
        const groupPercent = totalReferences > 0 ? ((metrics.groupReferences / totalReferences) * 100).toFixed(1) : '0.0';
        const thirdPartyPercent = totalReferences > 0 ? ((metrics.thirdPartyReferences / totalReferences) * 100).toFixed(1) : '0.0';

        // Create canvas for this person's chart
        const canvas = document.createElement('canvas');
        canvas.id = `topic-chart-${person.replace(/\s+/g, '-')}`;
        canvas.style.marginTop = '10px';
        canvas.style.marginBottom = '20px';

        personDiv.innerHTML = `
            <h3 style="color: #333;">${person}'s Conversation Focus</h3>
            <p>Messages analyzed: ${total}</p>
        `;
        personDiv.appendChild(canvas);
        container.appendChild(personDiv);

        // Create pie chart for this person
        const ctx = canvas.getContext('2d');
        if (ctx) {
            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: [
                        `Self-focused (${selfPercent}%)`,
                        `Other-focused (${otherPercent}%)`,
                        `Group-focused (${groupPercent}%)`,
                        `Third Party (${thirdPartyPercent}%)`
                    ],
                    datasets: [{
                        data: [
                            metrics.selfReferences,
                            metrics.otherReferences,
                            metrics.groupReferences,
                            metrics.thirdPartyReferences
                        ],
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.8)',   // Pink
                            'rgba(54, 162, 235, 0.8)',   // Blue
                            'rgba(255, 206, 86, 0.8)',   // Yellow
                            'rgba(75, 192, 192, 0.8)'    // Teal
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (context: any) => {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${value} references (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    });
}

async function loadChat(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name');
    console.log('Loading chat for name:', name);  // Debug log
    
    if (!name) {
        document.getElementById('chat-content')!.textContent = 'No name specified';
        return;
    }

    document.getElementById('chat-title')!.textContent = `WhatsApp Chat with ${name}`;
    
    try {
        const fileName = 'WhatsApp Chat with ' + name;
        console.log('Searching for file:', fileName);  // Debug log
        
        const searchResponse = await gapi.client.drive.files.list({
            q: `name = '${fileName}.txt' and mimeType = 'text/plain'`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        console.log('Search response:', searchResponse);  // Debug log
        const files = searchResponse.result.files;
        
        if (!files || files.length === 0) {
            console.log('No files found');  // Debug log
            document.getElementById('chat-content')!.textContent = 'No chat file found';
            return;
        }

        const fileId = files[0].id;
        console.log('Found file ID:', fileId);  // Debug log
        
        const fileResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        console.log('File response:', fileResponse);  // Debug log
        const messages = parseWhatsAppChat(fileResponse.body);
        console.log('Number of messages parsed:', messages.length);  // Debug log
        
        if (messages.length > 0) {
            console.log('Sample message:', messages[0]);  // Debug log
            displayMessages(messages);
        } else {
            document.getElementById('chat-content')!.textContent = 'No messages found in file';
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        document.getElementById('chat-content')!.textContent = 'Error loading chat';
    }
}

async function initializeGapiClient(): Promise<void> {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOC,
        });
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: loadChat
        });
        
        await handleAuthClick();
    } catch (error) {
        console.error('Error initializing GAPI client:', error);
    }
}

async function handleAuthClick(): Promise<void> {
    try {
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    } catch (error) {
        console.error('Error requesting access token:', error);
    }
}

// Initialize the API
gapi.load('client', initializeGapiClient); 