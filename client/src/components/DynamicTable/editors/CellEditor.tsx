import type { CellEditorProps } from '../types';
import { isCompositeColumn, isFieldColumn } from '../types';
import { TextEditor } from './TextEditor';
import { NumberEditor } from './NumberEditor';
import { DropdownEditor } from './DropdownEditor';
import { MultiSelectDropdownEditor } from './MultiSelectDropdownEditor';
import { DateEditor, DateTimeEditor, TimeEditor } from './DateTimeEditors';
import { BooleanEditor } from './ToggleEditors';
import { CheckboxEditor } from './CheckboxEditor';
import { CompositeEditor } from './CompositeEditor';
import { ProgressEditor } from './ProgressEditor';
import { RatingEditor } from './RatingEditor';
import { TagsEditor } from './TagsEditor';
import { AttachmentEditor } from './AttachmentEditor';
import { LookupEditor } from './LookupEditor';
import { UserAssigneeEditor } from './UserAssigneeEditor';


export function CellEditor(props: CellEditorProps) {
  const { column } = props;
  if (isCompositeColumn(column)) {
    return <CompositeEditor {...props} />;
  }

  // Assign people filtered by the field's user tags (stores user id[]).
  if (isFieldColumn(column) && column.userTags) {
    return <UserAssigneeEditor {...props} />;
  }

  // A column that reads its choices from another table is edited by searching that table.
  if (isFieldColumn(column) && column.lookup) {
    return <LookupEditor {...props} />;
  }

  switch (column.dataType) {
    case 'number':
    case 'currency':
      return <NumberEditor {...props} />;
    case 'dropdown':
    case 'status':
      return <DropdownEditor {...props} />;
    case 'date':
      return <DateEditor {...props} />;
    case 'datetime':
      return <DateTimeEditor {...props} />;
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
