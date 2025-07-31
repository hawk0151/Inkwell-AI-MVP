import axios from 'axios';

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const response = await axios({
    method: 'post',
    url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    data: 'grant_type=client_credentials',
  });

  accessToken = response.data.access_token;
  tokenExpiry = now + (response.data.expires_in - 60) * 1000;
  return accessToken;
}

export async function createOrder(orderData) {
  const token = await getAccessToken();
  const response = await axios.post(`${PAYPAL_API_BASE}/v2/checkout/orders`, orderData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return response.data;
}

export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const response = await axios.post(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return response.data;
}
