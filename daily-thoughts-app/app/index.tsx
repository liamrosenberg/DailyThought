import React, { useState, useEffect } from 'react';
import { 
  Alert, StyleSheet, View, TextInput, Button, Text, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { router } from 'expo-router';

// 1. Define the fake domain for the Ghost Email trick
const DUMMY_DOMAIN = '@dailythoughts.local';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper to ensure usernames are standardized
  const getCleanUsername = () => username.toLowerCase().trim();
  const getGhostEmail = () => `${getCleanUsername()}${DUMMY_DOMAIN}`;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/feed');
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/feed');
    });
  }, []);

  async function handleRegister() {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill out all fields.');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters.');
      return;
    }

    setLoading(true);
    const cleanUsername = getCleanUsername();

    // Sign up using the Ghost Email AND send the username to the database trigger
    const { data, error } = await supabase.auth.signUp({
      email: getGhostEmail(),
      password,
      options: {
        data: {
          username: cleanUsername,
        }
      }
    });
    
    if (error) {
      let msg = error.message;
      if (msg.includes('email')) msg = msg.replace('email', 'username');
      Alert.alert('Registration Error', msg);
    } else {
      Alert.alert('Success', 'Successfully registered!');
      setIsLogin(true); // Automatically flip back to login mode
    }
    setLoading(false);
  }

  async function handleLogin() {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter your username and password.');
      return;
    }
    setLoading(true);
    
    // Log them in using the generated Ghost Email (No RPC lookup needed anymore!)
    const { error: signInError } = await supabase.auth.signInWithPassword({ 
      email: getGhostEmail(), 
      password: password 
    });
    
    if (signInError) {
      Alert.alert('Error', 'Invalid username or password.');
    } else {
      router.replace('/feed');
    }
    
    setLoading(false);
  }

  return (
    // Wrap the entire screen to prevent the keyboard from blocking inputs
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Daily Thoughts</Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#888"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            autoCapitalize="none"
          />
          
          <View style={styles.buttonContainer}>
            <Button 
              title={loading ? "..." : (isLogin ? "Log In" : "Register")} 
              disabled={loading} 
              onPress={isLogin ? handleLogin : handleRegister} 
            />
          </View>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchModeContainer}>
            <Text style={styles.switchModeText}>
              {isLogin ? "Don't have an account? Register here." : "Already have an account? Log in."}
            </Text>
          </TouchableOpacity>

        </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  buttonContainer: {
    marginBottom: 15,
    marginTop: 10,
  },
  switchModeContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  switchModeText: {
    textAlign: 'center',
    color: '#555',
    fontSize: 14,
  }
});