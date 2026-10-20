import type { CellEditorProps } from '../types';
import { isCompositeColumn } from '../types';
import { TextEditor } from './TextEditor';
import { NumberEditor } from './NumberEditor';
import { DropdownEditor } from './DropdownEditor';
import { MultiSelectDropdownEditor } from './MultiSelectDropdownEditor';
import { DateEditor, TimeEditor } from './DateTimeEditors';
import { BooleanEditor } from './ToggleEditors';
import { CheckboxEditor } from './CheckboxEditor';
import { CompositeEditor } from './CompositeEditor';
import { ProgressEditor } from './ProgressEditor';
import { RatingEditor } from './RatingEditor';
import { TagsEditor } from './TagsEditor';
import { AttachmentEditor } from './AttachmentEditor';


export function CellEditor(props: CellEditorProps) {
  const { column } = props;
  if (isCompositeColumn(column)) {
    return <CompositeEditor {...props} />;
  }

  switch (column.dataType) {
    case 'number':
    case 'currency':
      return <NumberEditor {...props} />;
    case 'dropdown':
    case 'status':
      return <DropdownEditor {...props} />;
    case 'date':
    case 'datetime':
      return <DateEditor {...props} />;
    case 'time':
      return <TimeEditor {...props} />;
    case 'boolean':
      return <BooleanEditor {...props} />;
    case 'checkbox':
      return <CheckboxEditor {...props} />;
    case 'progress':
      return <ProgressEditor {...props} />;
    case 'rating':
      return <RatingEditor {...props} />;
    case 'tags':
      return <TagsEditor {...props} />;
    case 'multiselect':
      return <MultiSelectDropdownEditor {...props} />;
    case 'attachment':
      return <AttachmentEditor {...props} />;
    case 'email':
    case 'phone':
    default:
      return <TextEditor {...props} />;
  }
}
