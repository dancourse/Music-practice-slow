// Check if a user has earned referral rewards
// Note: In production, this would query a database

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

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const userId = event.queryStringParameters?.userId;

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing userId parameter' })
            };
        }

        // In a real implementation, you would:
        // 1. Query the database for referrals where this user is the referrer
        // 2. Count how many successful referrals they have
        // 3. Determine if they should receive a reward
        // 4. Return the reward status

        // For now, we return a placeholder response
        // The actual reward tracking happens client-side for this MVP
        // In production, you'd want server-side validation

        console.log(`Checking referral status for user: ${userId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                userId: userId,
                hasReward: false, // Would be true if they have pending rewards
                referralCount: 0,
                message: 'Referral status checked'
            })
        };

    } catch (error) {
        console.error('Error checking referral status:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
