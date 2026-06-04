import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type AppState = {
  isHydrated: boolean;
};

const initialState: AppState = {
  isHydrated: false,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setHydrated: (state, action: PayloadAction<boolean>) => {
      state.isHydrated = action.payload;
    },
  },
});

export const { setHydrated } = appSlice.actions;
export default appSlice.reducer;