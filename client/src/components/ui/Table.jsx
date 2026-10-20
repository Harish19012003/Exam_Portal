import React from 'react';
import { DynamicTable } from '../DynamicTable';

/**
 * Default Project Table Component
 * Imported from Option A (Dashboard-Option-A/src/components/DynamicTable)
 * Provides advanced sorting, filtering, aggregations, formula columns,
 * composite columns, customizable density, inline editing, and export capabilities.
 */
export const Table = (props) => {
  return <DynamicTable {...props} />;
};

export { DynamicTable };
export default Table;
