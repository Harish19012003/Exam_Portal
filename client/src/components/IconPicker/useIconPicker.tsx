import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconPickerModal, type IconPickerModalProps } from './IconPickerModal';

export interface UseIconPickerOptions {
  initialIcon?: string;
  isDarkMode: boolean;
  onSelect?: (iconName: string) => void;
  title?: string;
  description?: string;
  descriptionMobile?: string;
  applyLabel?: string;
}

export function useIconPicker({
  initialIcon = 'external-link',
  isDarkMode,
  onSelect,
  title,
  description,
  descriptionMobile,
  applyLabel,
}: UseIconPickerOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [icon, setIcon] = useState(initialIcon);

  useEffect(() => {
    setIcon(initialIcon);
  }, [initialIcon]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleSelectIcon = useCallback(
    (iconName: string) => {
      setIcon(iconName);
      onSelect?.(iconName);
    },
    [onSelect],
  );

  const modalProps = useMemo<Omit<IconPickerModalProps, 'isOpen'>>(
    () => ({
      currentIconName: icon,
      isDarkMode,
      onClose: close,
      onSelectIcon: handleSelectIcon,
      title,
      description,
      descriptionMobile,
      applyLabel,
    }),
    [applyLabel, close, description, descriptionMobile, handleSelectIcon, icon, isDarkMode, title],
  );

  return {
    icon,
    setIcon,
    isOpen,
    open,
    close,
    modalProps,
  };
}

export interface IconPickerProps extends IconPickerModalProps {}

export function IconPicker(props: IconPickerProps) {
  return <IconPickerModal {...props} />;
}

export function UseIconPickerModal({
  isOpen,
  modalProps,
}: {
  isOpen: boolean;
  modalProps: Omit<IconPickerModalProps, 'isOpen'>;
}) {
  return <IconPickerModal isOpen={isOpen} {...modalProps} />;
}
