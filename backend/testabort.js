import fetch from 'node-fetch';
import NodeAbortController from 'node-abort-controller';

const AbortController = typeof globalThis.AbortController === 'function' 
    ? globalThis.AbortController 
    : NodeAbortController;

async function testAbort() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    try {
        const response = await fetch('https://httpbin.org/delay/5', { signal: controller.signal });
        console.log('Response received:', response.status);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted successfully.');
        } else {
            console.error('Fetch failed:', error);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

testAbort();
