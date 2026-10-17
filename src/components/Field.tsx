/**
 * Form controls for the two sheets.
 *
 * `TextInput` is a React Native primitive and compiles to a real `<input>`
 * on the web, so keyboard, autofill and assistive technology all behave
 * natively without a web-specific branch.
 */

import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps, type KeyboardTypeOptions } from "react-native";

import { color, radius, space, type } from "../theme";
import { Txt } from "./primitives";

interface FieldProps extends Pick<TextInputProps, "autoComplete" | "autoCapitalize" | "maxLength" | "onSubmitEditing" | "returnKeyType"> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Shown under the field in coral. Presence of this also marks the border. */
  error?: string | null;
  /** A fixed prefix inside the field, e.g. "$". */
  prefix?: string;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
  prefix,
  ...inputProps
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Txt variant="caption" tone="textSecondary">
        {label}
      </Txt>
      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          !!error && styles.inputShellError,
        ]}
      >
        {prefix ? (
          <Txt variant="title" tone="textSecondary">
            {prefix}
          </Txt>
        ) : null}
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.textMuted}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          accessibilityLabel={label}
        />
      </View>
      {error ? (
        <Txt variant="caption" tone="negative">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** A row of mutually exclusive choices, used for asset kind and token. */
export function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Txt variant="caption" tone="textSecondary">
        {label}
      </Txt>
      <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.choice, active && styles.choiceActive]}
            >
              <Txt variant="caption" tone={active ? "accentInk" : "textSecondary"}>
                {option.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A labelled switch row, used in Settings. */
export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={styles.toggleRow}
    >
      <View style={styles.toggleCopy}>
        <Txt variant="bodyStrong">{label}</Txt>
        {description ? (
          <Txt variant="caption" tone="textMuted">
            {description}
          </Txt>
        ) : null}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: color.well,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.hairline,
    paddingHorizontal: space.md,
    height: 48,
  },
  inputShellFocused: {
    borderColor: color.accent,
  },
  inputShellError: {
    borderColor: color.negative,
  },
  input: {
    flex: 1,
    color: color.text,
    ...(type.title as object),
    // react-native-web puts a UA outline on the inner input; the shell
    // already carries the focus state.
    outlineStyle: "none",
  } as object,
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  choice: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.well,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  choiceActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: space.sm,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  track: {
    width: 46,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: color.well,
    borderWidth: 1,
    borderColor: color.hairline,
    padding: 3,
    justifyContent: "center",
  },
  trackOn: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.textSecondary,
  },
  knobOn: {
    backgroundColor: color.accentInk,
    alignSelf: "flex-end",
  },
});
