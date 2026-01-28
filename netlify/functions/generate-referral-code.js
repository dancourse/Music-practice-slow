// Generate and register a new referral code
// Note: In production, use a database like FaunaDB, Supabase, or Netlify Blobs

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
        const { userId, code } = JSON.parse(event.body);

        if (!userId || !code) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing userId or code' })
            };
        }

        // Validate code format
        if (!/^REF-[A-Z0-9]{8}$/.test(code)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid code format' })
            };
        }

        // In a real implementation, you would:
        // 1. Check if the code already exists in your database
        // 2. Store the code -> userId mapping
        // 3. Return success or generate a new unique code if collision

        // For now, we just acknowledge the code
        // The client stores it locally, and we can verify it when referrals happen

        console.log(`Referral code registered: ${code} for user ${userId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                code: code,
                message: 'Referral code registered'
            })
        };

    } catch (error) {
        console.error('Error generating referral code:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
