import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import CONFIG from '../config';

// SecureStore does NOT work on web, so fall back to localStorage there.
// (On web, SecureStore throws, which would look like a "Network Error" even
// when the login itself succeeded.)
const storage = {
  async set(key, value) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, String(value));
    } else {
      await SecureStore.setItemAsync(key, String(value));
    }
  },
};

// Show the URL in logs without leaking the API key
const maskKey = (url) => url.replace(/(api_key=)[^&]+/, '$1***');

export default function LoginScreen() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!credentials.username || !credentials.password) {
      Alert.alert('Validation Error', 'Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=login_verify`;

    console.log('==== LOGIN DEBUG ====');
    console.log('Platform:', Platform.OS);
    console.log('API_BASE_URL:', CONFIG.API_BASE_URL);
    console.log('Request URL:', maskKey(url));
    console.log('Payload:', { username: credentials.username, password: '***' });

    const startedAt = Date.now();

    try {
      const response = await axios.post(
        url,
        {
          username: credentials.username,
          password: credentials.password
        },
        {
          timeout: 20000, // 20 seconds
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          // Get the raw text so PHP warnings / HTML errors are visible
          transformResponse: [(data) => data],
        }
      );

      console.log('Time taken (ms):', Date.now() - startedAt);
      console.log('HTTP status:', response.status);
      console.log('Raw response:', response.data);

      let result;
      try {
        result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      } catch (parseErr) {
        console.log('JSON parse failed. Server did not return valid JSON.');
        Alert.alert(
          'Invalid Server Response',
          'The server did not return valid JSON. Check the console "Raw response" line.'
        );
        return;
      }

      console.log('Parsed result:', result);

      if (result.status === 'success') {
        await storage.set('isAuthenticated', 'true');
        await storage.set('user_id', result.user.id);
        await storage.set('user_name', result.user.name);
        await storage.set('user_type', result.user.user_type);

        router.replace('/dashboard');
      } else {
        Alert.alert(
          'Access Denied',
          result.message || 'Invalid username or password.'
        );
      }
    } catch (error) {
      console.log('Time taken (ms):', Date.now() - startedAt);
      console.log('Error name:', error.name);
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);

      let title = 'Error';
      let message = error.message;

      if (error.code === 'ECONNABORTED') {
        title = 'Request Timed Out';
        message = 'The server took too long to respond (20s).';
      } else if (error.response) {
        // Server replied, but with an error status (404, 500, ...)
        console.log('Error status:', error.response.status);
        console.log('Error body:', error.response.data);
        title = `Server Error ${error.response.status}`;
        message = 'The server returned an error. Check the console for the response body.';
      } else if (error.request) {
        // Request sent, no response: CORS, wrong URL, http/https, no internet
        console.log('No response received. Likely CORS, wrong URL, http/https mismatch, or server down.');
        title = 'Network Error';
        message = 'No response from server. Possible causes: CORS, wrong API URL, http vs https, or server down.';
      } else if (String(error.message).toLowerCase().includes('secure')) {
        title = 'Storage Error';
        message = 'Login worked but saving the session failed: ' + error.message;
      }

      Alert.alert(title, message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.title}>Balu Design Team</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username or Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor="#999"
            value={credentials.username}
            onChangeText={(text) => setCredentials({ ...credentials, username: text })}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#999"
            value={credentials.password}
            onChangeText={(text) => setCredentials({ ...credentials, password: text })}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.3)',
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    boxShadow: '0px 4px 8px rgba(59, 130, 246, 0.3)',
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});