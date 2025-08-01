/**
 * Sanitise headers to remove sensitive information
 */
const sanitiseHeaders = (headers: any): Record<string, string> => {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitised: Record<string, string> = {};

    Object.keys(headers).forEach(key => {
        if (sensitiveHeaders.includes(key.toLowerCase())) {
            sanitised[key] = '[REDACTED]';
        } else {
            sanitised[key] = headers[key];
        }
    });

    return sanitised;
}

export default sanitiseHeaders;