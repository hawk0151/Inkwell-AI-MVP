// test-lulu-cover-dimensions.js
import dotenv from 'dotenv';
dotenv.config();

import { getCoverDimensionsFromApi } from './src/services/lulu.service.js'; // correct path

async function testCoverDimensions() {
  try {
    const productId = '0550X0850BWSTDCW060UC444GXX'; // your product ID
    const pageCount = 73; // your interior page count

    const dims = await getCoverDimensionsFromApi(productId, pageCount, 'mm');
    console.log('Cover Dimensions from Lulu API:', dims);
  } catch (error) {
    console.error('Error fetching cover dimensions:', error);
  }
}

testCoverDimensions();
