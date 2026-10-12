import { cssInterop } from 'nativewind';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';

cssInterop(KeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

type FormScrollViewProps = KeyboardAwareScrollViewProps & {
  className?: string;
  contentContainerClassName?: string;
};

export function FormScrollView(props: FormScrollViewProps) {
  return <KeyboardAwareScrollView bottomOffset={20} disableScrollOnKeyboardHide keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" enabled={!props.horizontal} {...props} />;
}