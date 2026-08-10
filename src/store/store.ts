import { configureStore } from "@reduxjs/toolkit";
import appReducer from "./slices/appSlice";
import notificationReducer from "./slices/notificationSlice";

export const store = configureStore({
  reducer: {
    app: appReducer,
    notifications: notificationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
