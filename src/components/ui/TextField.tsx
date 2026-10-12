import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { FieldShell, fieldA11yLabel, fieldBoxColors, fieldStyles, type FieldBaseProps } from "./Field";

export type TextFieldProps = Omit<TextInputProps, "style" | "editable"> &
  FieldBaseProps & {
    /** Ionicons name inside the box on the left. */
    leftIcon?: string;
    /** Ionicons name inside the box on the right (ignored for secure fields, which show the eye toggle). */
    rightIcon?: string;
    onRightIconPress?: () => void;
    rightIconLabel?: string;
    /** Visible lines for multiline fields. Default 4. */
    rows?: number;
    inputStyle?: StyleProp<TextStyle>;
  };

/**
 * Labelled text input with helper / error text, icons and a password visibility toggle.
 * Forwards its ref to the TextInput, so focus chaining works:
 *
 *   const emailRef = useRef<TextInput>(null);
 *   <TextField label="Name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
 *   <TextField ref={emailRef} label="Email" keyboardType="email-address" />
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextFieldImpl(
  {
    label,
    required,
    helperText,
    error,
    disabled = false,
    containerStyle,
    leftIcon,
    rightIcon,
    onRightIconPress,
    rightIconLabel,
    secureTextEntry,
    multiline,
    rows = 4,
    inputStyle,
    onFocus,
    onBlur,
    placeholderTextColor,
    accessibilityLabel,
    accessibilityHint,
    ...inputProps
  },
  ref,
) {
  const { colors, typography } = useTheme();
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => inputRef.current as TextInput, []);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const box = fieldBoxColors(colors, { focused, error: !!error, disabled });
  const iconColor = error ? colors.danger : focused ? colors.primary : colors.textMuted;
  const lineHeight = typography.body.lineHeight;

  return (
    <FieldShell label={label} required={required} helperText={helperText} error={error} disabled={disabled} containerStyle={containerStyle}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        disabled={disabled}
        accessible={false}
        style={[
          fieldStyles.box,
          box,
          multiline && [styles.multilineBox, { minHeight: rows * lineHeight + 24 }],
        ]}
      >
        {leftIcon ? <Ionicons name={leftIcon} size={20} color={iconColor} style={multiline ? styles.topIcon : undefined} /> : null}
        <TextInput
          ref={inputRef}
          {...inputProps}
          editable={!disabled}
          multiline={multiline}
          secureTextEntry={!!secureTextEntry && !revealed}
          placeholderTextColor={placeholderTextColor ?? colors.placeholder}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel={accessibilityLabel ?? fieldA11yLabel(label, required)}
          accessibilityHint={accessibilityHint ?? (error ? `Error: ${error}` : helperText)}
          accessibilityState={{ disabled }}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            typography.body,
            styles.input,
            { color: disabled ? colors.textMuted : colors.text },
            multiline && [styles.multilineInput, { minHeight: rows * lineHeight }],
            inputStyle,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            onPress={() => setRevealed(v => !v)}
            hitSlop={6}
            style={styles.trailing}
          >
            <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
          </Pressable>
        ) : rightIcon ? (
          onRightIconPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={rightIconLabel ?? rightIcon}
              onPress={onRightIconPress}
              disabled={disabled}
              hitSlop={6}
              style={styles.trailing}
            >
              <Ionicons name={rightIcon} size={20} color={iconColor} />
            </Pressable>
          ) : (
            <Ionicons name={rightIcon} size={20} color={iconColor} />
          )
        ) : null}
      </Pressable>
    </FieldShell>
  );
});

const styles = StyleSheet.create({
  input: { flex: 1, paddingVertical: 10, paddingHorizontal: 0, includeFontPadding: false },
  trailing: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginRight: -6 },
  topIcon: { marginTop: 2 },
  multilineBox: { alignItems: "flex-start", paddingVertical: 10 },
  multilineInput: { textAlignVertical: "top" },
});
