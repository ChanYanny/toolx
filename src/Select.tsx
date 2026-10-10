import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export function Select<T extends string>({ label, value, onChange, options, id }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  id?: string;
}) {
  return <SelectPrimitive.Root value={value} onValueChange={(next) => {
    const option = options.find((item) => item.value === next);
    if (option) onChange(option.value);
  }}>
    <SelectPrimitive.Trigger id={id} className="select-trigger" aria-label={label}>
      <SelectPrimitive.Value />
      <SelectPrimitive.Icon className="select-chevron"><ChevronDown size={14} strokeWidth={1.7} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="select-content" position="popper" sideOffset={6} collisionPadding={12}>
        <SelectPrimitive.ScrollUpButton className="select-scroll"><ChevronUp size={14} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="select-options">
          {options.map((option) => <SelectPrimitive.Item className="select-option" value={option.value} key={option.value}>
            <div className="select-option-copy">
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              {option.description && <span className="select-description">{option.description}</span>}
            </div>
            <SelectPrimitive.ItemIndicator className="select-check"><Check size={14} strokeWidth={1.8} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="select-scroll"><ChevronDown size={14} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
