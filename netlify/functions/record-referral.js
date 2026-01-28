// Record when a referred user signs up (adds their first video)
// Note: In production, use a database and implement proper referral reward logic

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { referrerCode, newUserId } = JSON.parse(event.body);

        if (!referrerCode || !newUserId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing referrerCode or newUserId' })
            };
        }

        // Validate referrer code format
        if (!/^REF-[A-Z0-9]{8}$/.test(referrerCode)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid referrer code format' })
            };
        }

        // In a real implementation, you would:
        // 1. Look up the referrer's userId from the referrerCode
        // 2. Store this referral event (newUserId was referred by referrerCode)
        // 3. Update the referrer's account to grant them the reward
        // 4. Send notification to referrer (email, in-app, etc.)

        console.log(`Referral recorded: User ${newUserId} was referred by ${referrerCode}`);

        // For a production system, you might want to:
        // - Use Heap Analytics API to track this server-side
        // - Send a webhook to Slack for monitoring
        // - Store in a database for the check-referral-status endpoint

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Referral recorded successfully',
                referrerCode: referrerCode
            })
        };

    } catch (error) {
        console.error('Error recording referral:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
