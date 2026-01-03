/**
 * API Configuration
 * 
 * For Android Emulator: use http://10.0.2.2:8000
 * For iOS Simulator: use http://localhost:8000
 * For Physical Device: use your computer's LAN IP (e.g., http://192.168.1.100:8000)
 * 
 * To find your LAN IP:
 * - Windows: ipconfig (look for IPv4 Address)
 * - Mac/Linux: ifconfig or ip addr
 */
export const API_BASE_URL = __DEV__
  ? "http://100.86.123.69:8000"
  : "https://your-production-api.com";


export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
};

