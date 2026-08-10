import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  receivedAt: string;
  read: boolean;
};

const STORAGE_KEY = "@worknest_notifications";

export const loadNotifications = createAsyncThunk("notifications/load", async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AppNotification[]) : [];
});

export const persistNotifications = createAsyncThunk(
  "notifications/persist",
  async (notifications: AppNotification[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }
);

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    items: [] as AppNotification[],
    loaded: false,
  },
  reducers: {
    addNotification(state, action: PayloadAction<AppNotification>) {
      state.items.unshift(action.payload);
    },
    markAllRead(state) {
      state.items.forEach(n => { n.read = true; });
    },
    markRead(state, action: PayloadAction<string>) {
      const n = state.items.find(i => i.id === action.payload);
      if (n) n.read = true;
    },
    clearAll(state) {
      state.items = [];
    },
  },
  extraReducers: builder => {
    builder.addCase(loadNotifications.fulfilled, (state, action) => {
      state.items = action.payload;
      state.loaded = true;
    });
  },
});

export const { addNotification, markAllRead, markRead, clearAll } = notificationSlice.actions;
export default notificationSlice.reducer;
