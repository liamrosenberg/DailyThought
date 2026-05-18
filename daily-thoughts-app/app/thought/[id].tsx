import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../supabaseClient';
import { User } from '@supabase/supabase-js';

// The Blueprints
interface Reply {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string; current_streak: number }; // <-- Added current_streak
}

interface Thought {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string; current_streak: number }; // <-- Added current_streak
}

export default function ThreadScreen() {
  // Grab the specific thought ID from the URL/Router
  const { id } = useLocalSearchParams(); 
  
  const [mainThought, setMainThought] = useState<Thought | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
    fetchThread();
  }, []);

  async function fetchThread() {
    // 1. Fetch the main thought
    const { data: thoughtData } = await supabase
      .from('thoughts')
      .select(`id, content, created_at, profiles(username, current_streak)`) // <-- Updated
      .eq('id', id)
      .single();
    
    setMainThought(thoughtData as any as Thought);

    // 2. Fetch all replies attached to this thought ID
    const { data: replyData } = await supabase
      .from('replies')
      .select(`id, content, created_at, profiles(username, current_streak)`) // <-- Updated
      .eq('thought_id', id)
      .order('created_at', { ascending: true }); 

    setReplies(replyData as any as Reply[] || []);
  }

  async function handlePostReply() {
    if (!newReply.trim() || !currentUser) return;
    setLoading(true);

    // 1. Post the reply
    const { error } = await supabase
      .from('replies')
      .insert({
        thought_id: id,
        user_id: currentUser.id,
        content: newReply
      });

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    // 2. Calculate and update the streak
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
        const lastPostDay = new Date(lastPost.getFullYear(), lastPost.getMonth(), lastPost.getDate());
        const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const diffTime = Math.abs(todayDay.getTime() - lastPostDay.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Already posted today, keep streak the same (default to 1 if it was 0)
          newStreak = profile.current_streak || 1; 
        } else if (diffDays === 1) {
          // Posted yesterday, increment streak!
          newStreak = (profile.current_streak || 0) + 1;
        } else {
          // Missed a day, streak broken
          newStreak = 1;
        }
      }
    }

    // 3. Save the new streak to the database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ current_streak: newStreak, last_post_date: newLastPostDate })
      .eq('id', currentUser.id);

    if (updateError) {
      console.error("Streak Update Error:", updateError.message);
    }

    setNewReply(''); 
    fetchThread();   // Refresh the UI!
    setLoading(false);
  }

  const renderReply = ({ item }: { item: Reply }) => (
    <View style={styles.replyCard}>
      <Text style={styles.replyUsername}>
        @{item.profiles?.username || 'Unknown'} 🔥 {item.profiles?.current_streak || 0}
      </Text>
      <Text style={styles.replyContent}>{item.content}</Text>
    </View>
  );

  // If the data hasn't loaded yet, show a spinner
  if (!mainThought) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    // Wrap the screen to push the input up when typing
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // Accounts for Expo Router's top back-button header
    >
      <View style={styles.mainThoughtCard}>
        <Text style={styles.mainUsername}>
          @{mainThought.profiles?.username || 'Unknown'} 🔥 {mainThought.profiles?.current_streak || 0}
        </Text>
        <Text style={styles.mainContent}>{mainThought.content}</Text>
      </View>

      <Text style={styles.replyHeader}>Replies</Text>

      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        renderItem={renderReply}
        contentContainerStyle={styles.listContainer}
      />

      <View style={styles.composeBox}>
        <TextInput
          style={styles.input}
          placeholder="Write a reply..."
          value={newReply}
          onChangeText={setNewReply}
          returnKeyType="send" // Keyboard submit button
          onSubmitEditing={handlePostReply} // Action when keyboard submit is pressed
        />
        <Button title={loading ? "..." : "Reply"} onPress={handlePostReply} disabled={loading || !newReply} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 15, paddingBottom: 20 }, // Pad bottom so the reply box doesn't cover text
  
  mainThoughtCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  mainUsername: { fontWeight: 'bold', fontSize: 18, color: '#0066cc', marginBottom: 5 },
  mainContent: { fontSize: 20, color: '#333' },
  
  replyHeader: { padding: 15, fontSize: 16, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },
  
  replyCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 20, // Indent replies to make it look like a thread
    borderLeftWidth: 3,
    borderLeftColor: '#0066cc',
  },
  replyUsername: { fontWeight: 'bold', color: '#555', marginBottom: 4 },
  replyContent: { fontSize: 15, color: '#333' },

  composeBox: {
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20, // Extra space at the bottom for modern phone screens
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    backgroundColor: '#fafafa',
  }
});