import axios from 'axios'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')

export function getToken() {
  return localStorage.getItem('sava_token')
}

export function setSession(token, user) {
  localStorage.setItem('sava_token', token)
  localStorage.setItem('sava_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('sava_token')
  localStorage.removeItem('sava_user')
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('sava_user')) } catch { return null }
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: { Accept: 'application/json' },
})

client.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  response => response.data,
  error => {
    const status = error.response?.status
    const data = error.response?.data
    const normalized = new Error(data?.message || error.message || 'Permintaan gagal.')
    normalized.status = status
    normalized.data = data

    if (status === 401 && !error.config?.url?.endsWith('/login')) {
      clearSession()
      window.dispatchEvent(new Event('sava:unauthorized'))
    }

    return Promise.reject(normalized)
  },
)

export const api = {
  login: async (email, password) => client.post('/login', { email, password }),
  logout: async () => client.post('/logout'),
  products: async () => client.get('/products'),
  createProduct: async body => client.post('/products', body),
  updateProduct: async (id, body) => client.put(`/products/${id}`, body),
  deleteProduct: async id => client.delete(`/products/${id}`),
  createVariant: async (productId, body) => client.post(`/products/${productId}/variants`, body),
  updateVariant: async (id, body) => client.put(`/variants/${id}`, body),
  deleteVariant: async id => client.delete(`/variants/${id}`),
  createTransaction: async items => client.post('/transactions', { items }),
  getProfile: async () => client.get('/business-profile'),
  updateProfile: async body => client.put('/business-profile', body),
}
