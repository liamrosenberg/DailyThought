import React, { useState } from 'react';
import { Alert, StyleSheet, View, TextInput, Button, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../supabase';

export default function AuthScreen() {
  // This state variable flips the screen between Login and Register modes
  const [isLogin, setIsLogin] = useState(true); 
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !username || !password) {
      Alert.alert('Error', 'Please fill out all fields.');
      return;
    }
    setLoading(true);
    // Note: We are saving the username into Supabase's metadata system here
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username } }
    });
    
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Success', 'Registered! You can now log in.');
    setLoading(false);
  }

  async function handleLogin() {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter your username and password.');
      return;
    }
    setLoading(true);
    
    // 1. Ask the database for the hidden email attached to this username
    const { data: userEmail, error: lookupError } = await supabase
      .rpc('get_user_email', { p_username: username });

    if (lookupError || !userEmail) {
      Alert.alert('Error', 'Username not found.');
      setLoading(false);
      return;
    }

    // 2. Log them in using that hidden email
    const { error: signInError } = await supabase.auth.signInWithPassword({ 
      email: userEmail, 
      password: password 
    });
    
    if (signInError) {
      Alert.alert('Error', signInError.message);
    } else {
      Alert.alert('Success', 'You are logged in!');
    }
    
    setLoading(false);
  }

  async function handleForgotPassword() {
    Alert.alert('Forgot Password', 'We will build the password reset flow soon!');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Thoughts</Text>
      
      {/* If they are registering, show the Email field */}
      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      )}

      {/* Both Login and Register need a Username field */}
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#888"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
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
      
      {/* Show the primary action button based on the mode */}
      <View style={styles.buttonContainer}>
        <Button 
          title={isLogin ? "Log In" : "Register"} 
          disabled={loading} 
          onPress={isLogin ? handleLogin : handleRegister} 
        />
      </View>

      {/* Forgot Password (Only show on Login screen) */}
      {isLogin && (
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.linkText}>Forgot your password?</Text>
        </TouchableOpacity>
      )}

      {/* The Toggle Switch at the bottom */}
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchModeContainer}>
        <Text style={styles.switchModeText}>
          {isLogin ? "Don't have an account? Register here." : "Already have an account? Log in."}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
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
    backgroundColor: '#f9f9f9'
  },
  buttonContainer: {
    marginBottom: 15,
    marginTop: 10,
  },
  linkText: {
    color: '#0066cc',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
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