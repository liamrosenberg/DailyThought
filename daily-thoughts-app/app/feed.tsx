import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, Button, FlatList, StyleSheet, 
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { router, Stack } from 'expo-router'; 
import { User } from '@supabase/supabase-js';

// --- Notification Imports ---
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

interface Thought {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string };
  replies: { count: number }[]; 
}

export default function FeedScreen() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [newThought, setNewThought] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // --- NEW: Streak State ---
  const [streak, setStreak] = useState(0);

  // 1. Initial Load
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (user) {
        fetchUserProfile(user.id); // Fetch streak on load
      }
      fetchThoughts();
    });
  }, []);

  // 2. Trigger Notification Permission Check when user is found
  useEffect(() => {
    if (currentUser) {
      registerForPushNotificationsAsync().then(token => {
        if (token) saveTokenToDatabase(token);
      });
    }
  }, [currentUser]);

  // --- NEW: Fetch Profile Info (Streak) ---
  async function fetchUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('current_streak')
      .eq('id', userId)
      .single();
      
    if (data) {
      setStreak(data.current_streak || 0);
    }
  }

  async function fetchThoughts() {
    const { data, error } = await supabase
      .from('thoughts')
      .select(`
        id,
        content,
        created_at,
        profiles ( username ),
        replies ( count )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      Alert.alert('Error fetching feed', error.message);
    } else {
      setThoughts(data as any as Thought[] || []);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchThoughts();
    setRefreshing(false);
  };

  async function handlePost() {
    if (!newThought.trim() || !currentUser) return;
    setLoading(true);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. Check if they hit their daily limit
    const { count } = await supabase
      .from('thoughts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .gte('created_at', startOfDay.toISOString());

    if ((count || 0) >= 2) {
      Alert.alert('Limit Reached', 'You have already shared your 2 thoughts for today!');
      setLoading(false);
      return;
    }

    // 2. Post the thought
    const { error: insertError } = await supabase
      .from('thoughts')
      .insert({ user_id: currentUser.id, content: newThought });

    if (insertError) {
      Alert.alert('Error posting', insertError.message);
      setLoading(false);
      return;
    }

    // --- NEW: Calculate and update the streak ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_streak, last_post_date')
      .eq('id', currentUser.id)
      .single();

    let newStreak = 1;
    let newLastPostDate = new Date().toISOString();

    if (profile) {
      const lastPost = profile.last_post_date ? new Date(profile.last_post_date) : null;
      const today = new Date();

      if (lastPost) {
        // Strip time to just compare the dates accurately
        const lastPostDay = new Date(lastPost.getFullYear(), lastPost.getMonth(), lastPost.getDate());
        const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        // Calculate difference in days
        const diffTime = Math.abs(todayDay.getTime() - lastPostDay.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Already posted today, keep streak the same
          newStreak = profile.current_streak;
        } else if (diffDays === 1) {
          // Posted yesterday, increment streak!
          newStreak = (profile.current_streak || 0) + 1;
        } else {
          // Missed a day, streak broken
          newStreak = 1;
        }
      }
    }

    // Update the database with the new streak
    await supabase
      .from('profiles')
      .update({ current_streak: newStreak, last_post_date: newLastPostDate })
      .eq('id', currentUser.id);

    setStreak(newStreak); // Update UI
    setNewThought(''); 
    fetchThoughts();   
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  // --- Notification Helper Functions ---
  async function saveTokenToDatabase(token: string) {
    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', currentUser?.id);
  }

  async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) return; 
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
    
    return token;
  }
  
  // --- UI Render ---
  const renderThought = ({ item }: { item: Thought }) => {
    const date = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const commentCount = item.replies?.[0]?.count || 0;
    
    return (
      <TouchableOpacity 
        style={styles.thoughtCard} 
        onPress={() => router.push({ pathname: '/thought/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
           <Text style={styles.username}>@{item.profiles?.username || 'Unknown'}</Text>
           <Text style={styles.timestamp}>{date}</Text>
        </View>
        <Text style={styles.content}>{item.content}</Text>
        <Text style={styles.commentCountText}>
          💬 {commentCount} {commentCount === 1 ? 'Reply' : 'Replies'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0} 
    >
      <Stack.Screen 
        options={{ 
          title: 'Daily Thoughts',
          // --- NEW: Add the streak counter to the header ---
          headerLeft: () => (
            <Text style={styles.streakText}>🔥 {streak}</Text>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          ),
        }} 
      />

      <FlatList
        data={thoughts}
        keyExtractor={(item) => item.id}
        renderItem={renderThought}
        contentContainerStyle={styles.feed}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <View style={styles.composeBox}>
        <TextInput
          style={styles.input}
          placeholder="What's on your mind? (Max 280 chars)"
          value={newThought}
          onChangeText={setNewThought}
          maxLength={280}
          returnKeyType="send"
          onSubmitEditing={handlePost}
        />
        <Button title={loading ? "..." : "Post"} onPress={handlePost} disabled={loading || !newThought} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  title: { fontSize: 20, fontWeight: 'bold' },
  // --- NEW STYLES ---
  streakText: { fontSize: 16, fontWeight: 'bold', marginRight: 15 },
  signOutText: { color: 'red', fontWeight: 'bold' },
  feed: { padding: 15 },
  thoughtCard: { 
    backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  username: { fontWeight: 'bold', color: '#0066cc' },
  timestamp: { fontSize: 12, color: '#888' },
  content: { fontSize: 16, color: '#333', marginBottom: 12 },
  commentCountText: { fontSize: 13, color: '#666', fontWeight: '600' },
  composeBox: { 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15, 
    paddingBottom: Platform.OS === 'ios' ? 35 : 20, 
    backgroundColor: '#fff', 
    borderTopWidth: 1,
    borderColor: '#ddd'
  },
  input: { 
    flex: 1,
    borderWidth: 1, borderColor: '#ccc', borderRadius: 20, 
    paddingHorizontal: 15, paddingVertical: 10, 
    marginRight: 10, backgroundColor: '#fafafa'
  }
});