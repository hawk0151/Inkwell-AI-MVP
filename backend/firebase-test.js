// firebase-test.js

// This loads the environment variables from your .env file
import 'dotenv/config';
import admin from 'firebase-admin';

async function testFirebaseConnection() {
    console.log('--- Firebase Connection Test ---');

    // Step 1: Check if environment variables are loaded
    console.log(`[TEST] FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'Loaded' : 'MISSING!'}`);
    console.log(`[TEST] FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? 'Loaded' : 'MISSING!'}`);
    console.log(`[TEST] FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? 'Loaded' : 'MISSING!'}`);

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.error('\n❌ Error: One or more required Firebase environment variables are missing.');
        return;
    }

    // Step 2: Assemble the service account object from environment variables
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // This line is crucial for correctly parsing the private key from a .env file
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    
    try {
        // Step 3: Initialize the Firebase Admin SDK
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('\n[INIT] Firebase Admin SDK initialized successfully.');
        } else {
            console.log('\n[INIT] Firebase Admin SDK was already initialized.');
        }

        // Step 4: Attempt to access Firestore
        console.log('[FIRESTORE] Attempting to connect to Firestore and list collections...');
        const firestore = admin.firestore();
        const collections = await firestore.listCollections();
        
        console.log('\n✅ SUCCESS! Connected to Firestore successfully.');
        console.log(`Found ${collections.length} collections:`);
        collections.forEach(collection => console.log(`- ${collection.id}`));

    } catch (error) {
        console.error('\n❌ FAILURE! An error occurred during the Firebase test:');
        console.error('----------------------------------------------------');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('----------------------------------------------------');
        console.error('This strongly suggests your service account credentials in the .env file are incorrect or outdated.');
    }
}

testFirebaseConnection();