import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { errorMessage } from "../../services/apiClient";
import {
  getAnnouncements,
  markAnnouncementRead,
  type Announcement,
} from "../../services/notificationService";

// Notifications = the signed-in user's announcements from the API (GET /mobile/announcements).
// Read state is the API's (POST /mobile/announcements/{id}/read); nothing is kept only on the device.

export type { Announcement };

/** Older app versions stored notifications on the device under this key; it is removed once. */
const LEGACY_STORAGE_KEY = "@worknest_notifications";

type NotificationState = {
  items: Announcement[];
  total: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const initialState: NotificationState = {
  items: [],
  total: 0,
  loading: false,
  loaded: false,
  error: null,
};

/** Loads the first page of announcements. Errors end up in state.error (shown by the screen). */
export const fetchAnnouncements = createAsyncThunk<
  { items: Announcement[]; total: number },
  void,
  { rejectValue: string }
>("notifications/fetch", async (_, { rejectWithValue }) => {
  AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => undefined);
  try {
    const page = await getAnnouncements(1, 50);
    return { items: page.items, total: page.total };
  } catch (error) {
    return rejectWithValue(errorMessage(error, "Notifications could not be loaded. Please try again."));
  }
});

/** Marks one announcement read on the API, then in the list. */
export const markAnnouncementAsRead = createAsyncThunk<string, string, { rejectValue: string }>(
  "notifications/markRead",
  async (id, { rejectWithValue }) => {
    try {
      await markAnnouncementRead(id);
      return id;
    } catch (error) {
      return rejectWithValue(errorMessage(error, "Could not mark the notification as read."));
    }
  },
);

/** Marks every unread announcement read (one call each: the API has no "read all"). */
export const markAllAnnouncementsRead = createAsyncThunk<
  string[],
  void,
  { state: { notifications: NotificationState }; rejectValue: string }
>("notifications/markAllRead", async (_, { getState, rejectWithValue }) => {
  const unread = getState().notifications.items.filter((n) => !n.isRead).map((n) => n.id);
  const results = await Promise.allSettled(unread.map((id) => markAnnouncementRead(id)));
  const done = unread.filter((_, i) => results[i].status === "fulfilled");
  if (unread.length > 0 && done.length === 0) {
    return rejectWithValue("Could not mark the notifications as read. Please try again.");
  }
  return done;
});

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    /** On sign-out: another account must never see these. */
    clearNotifications() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnnouncements.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnnouncements.fulfilled, (state, action) => {
        state.items = action.payload.items;
        state.total = action.payload.total;
        state.loading = false;
        state.loaded = true;
      })
      .addCase(fetchAnnouncements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Notifications could not be loaded. Please try again.";
      })
      .addCase(markAnnouncementAsRead.fulfilled, (state, action) => {
        const item = state.items.find((n) => n.id === action.payload);
        if (item) item.isRead = true;
      })
      .addCase(markAllAnnouncementsRead.fulfilled, (state, action) => {
        const ids = new Set(action.payload);
        state.items.forEach((n) => {
          if (ids.has(n.id)) n.isRead = true;
        });
      });
  },
});

export const { clearNotifications } = notificationSlice.actions;

/** Unread count for the notifications bell. */
export const selectUnreadCount = (state: { notifications: NotificationState }) =>
  state.notifications.items.filter((n) => !n.isRead).length;

export default notificationSlice.reducer;
