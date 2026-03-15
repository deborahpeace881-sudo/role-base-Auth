exports.handler = async (event, context) => {
    try {
        const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
        
        if (!IPINFO_TOKEN) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'IPINFO_TOKEN not configured' })
            };
        }

        // Get client IP from headers
        const clientIP = event.headers['client-ip'] || 
                        event.headers['x-forwarded-for'] || 
                        event.headers['x-real-ip'];

        // Fetch IP info from ipinfo.io
        const response = await fetch(`https://ipinfo.io/${clientIP || ''}/json?token=${IPINFO_TOKEN}`);
        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch IP info' })
        };
    }
};