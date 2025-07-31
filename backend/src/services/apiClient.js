// frontend/src/services/apiClient.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5001/api',
});

const apiMethods = {
  // --- Auth Methods ---
  signup: (email, password) => apiClient.post('/auth/signup', { email, password }),
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  googleLogin: (token) => apiClient.post('/auth/google', { token }),

  // --- Story Methods (Legacy) ---
  generateStory: (promptDetails) => apiClient.post('/story/generate', promptDetails),

  // --- Product Methods ---
  getBookOptions: () => apiClient.get('/products/book-options'),

  // --- Order Methods ---
  createCheckoutSession: (orderDetails, token) => {
    return apiClient.post('/orders/create-checkout-session', orderDetails, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  getMyOrders: (token) => {
    return apiClient.get('/orders/my-orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  
  // --- Picture Book Methods ---
  getMyPictureBooks: (token) => apiClient.get('/picture-books', { headers: { Authorization: `Bearer ${token}` } }),
  getPictureBook: (bookId, token) => apiClient.get(`/picture-books/${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
  createPictureBook: (projectData, token) => apiClient.post('/picture-books', projectData, { headers: { Authorization: `Bearer ${token}` } }),
  addTimelineEvent: (bookId, eventData, token) => apiClient.post(`/picture-books/${bookId}/events`, eventData, { headers: { Authorization: `Bearer ${token}` } }),
  deletePictureBook: (bookId, token) => apiClient.delete(`/picture-books/${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
  createBookCheckoutSession: (bookId, token) => apiClient.post(`/picture-books/${bookId}/checkout`, {}, { headers: { Authorization: `Bearer ${token}` } }),
  deleteLastTimelineEvent: (bookId, token) => apiClient.delete(`/picture-books/${bookId}/events/last`, { headers: { Authorization: `Bearer ${token}` } }),

  // --- Text Book Methods ---
  createTextBook: (bookData, token) => apiClient.post('/text-books', bookData, { headers: { Authorization: `Bearer ${token}` } }),
  getMyTextBooks: (token) => apiClient.get('/text-books', { headers: { Authorization: `Bearer ${token}` } }),
  getTextBookDetails: (bookId, token) => apiClient.get(`/text-books/${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
  generateNextChapter: (bookId, token) => apiClient.post(`/text-books/${bookId}/generate-chapter`, {}, { headers: { Authorization: `Bearer ${token}` } }),
  createTextBookCheckoutSession: (bookId, token) => apiClient.post(`/text-books/${bookId}/checkout`, {}, { headers: { Authorization: `Bearer ${token}` } }),

  // --- Image Methods ---
  generateImage: (prompt, style, token) => apiClient.post('/images/generate', { prompt, style }, { headers: { Authorization: `Bearer ${token}` } }),
  uploadImage: (formData, token) => apiClient.post('/images/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
  }),
};

export default apiMethods;