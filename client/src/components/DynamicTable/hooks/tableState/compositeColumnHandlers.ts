import type { ColumnConfig } from '../../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function createCompositeColumnHandlers(
  setColumns: SetState<ColumnConfig[]>,
  setColumnOrder: SetState<string[]>,
  setColumnWidths: SetState<Record<string, number>>,
  setColumnVisibility: SetState<Record<string, boolean>>,
) {
  const applyCompositeAdd = (col: ColumnConfig) => {
    setColumns(prev => {
      if (col.dataType !== 'composite') return [...prev, col];
      const sourceKeys = new Set(col.composedOf.map(p => p.field));
      const minOrder = Math.min(
        ...prev.filter(c => sourceKeys.has(c.key)).map(c => c.order),
      );
      return prev
        .map(c => (sourceKeys.has(c.key) ? { ...c, visible: false } : c))
        .concat({ ...col, order: Number.isFinite(minOrder) ? minOrder : col.order });
    });

    setColumnOrder(prev => {
      if (col.dataType !== 'composite') return [...prev, col.key];
      const sourceKeys = col.composedOf.map(p => p.field);
      const firstSourceIdx = Math.min(
        ...sourceKeys.map(k => prev.indexOf(k)).filter(i => i !== -1),
      );
      const next = [...prev];
      if (!Number.isFinite(firstSourceIdx)) next.push(col.key);
      else next.splice(firstSourceIdx, 0, col.key);
      return next;
    });

    setColumnWidths(prev => ({ ...prev, [col.key]: col.width }));
    setColumnVisibility(prev => {
      if (col.dataType !== 'composite') return { ...prev, [col.key]: true };
      const sourceKeys = col.composedOf.map(p => p.field);
      const next = { ...prev, [col.key]: true };
      sourceKeys.forEach(k => {
        next[k] = false;
      });
      return next;
    });
  };

  const handleDeleteCompositeColumn = (compositeKey: string) => {
    setColumns(prev => {
      const target = prev.find(c => c.key === compositeKey);
      if (!target || target.dataType !== 'composite') return prev;

      const sourceKeys = new Set(target.composedOf.map(p => p.field));
      const remainingComposites = prev.filter(
        c => c.dataType === 'composite' && c.key !== compositeKey,
      );
      const stillGrouped = new Set(
        remainingComposites.flatMap(c =>
          c.dataType === 'composite' ? c.composedOf.map(p => p.field) : [],
        ),
      );

      return prev
        .filter(c => c.key !== compositeKey)
        .map(c =>
          sourceKeys.has(c.key) && !stillGrouped.has(c.key) ? { ...c, visible: true } : c,
        );
    });

    setColumnOrder(prev => prev.filter(k => k !== compositeKey));
    setColumnVisibility(prev => {
      const next = { ...prev };
      delete next[compositeKey];
      return next;
    });
    setColumnWidths(prev => {
      const next = { ...prev };
      delete next[compositeKey];
      return next;
    });
  };

  const handleUpdateCompositeColumn = (oldKey: string, newCol: ColumnConfig) => {
    setColumns(prev => {
      if (newCol.dataType !== 'composite') return prev;

      const oldCol = prev.find(c => c.key === oldKey);
      if (!oldCol || oldCol.dataType !== 'composite') return prev;

      const oldSourceKeys = new Set(oldCol.composedOf.map(p => p.field));
      const newSourceKeys = new Set(newCol.composedOf.map(p => p.field));

      const otherComposites = prev.filter(c => c.dataType === 'composite' && c.key !== oldKey);
      const stillGrouped = new Set(
        otherComposites.flatMap(c =>
          c.dataType === 'composite' ? c.composedOf.map(p => p.field) : [],
        ),
      );

      const fieldsToRestore = new Set(
        [...oldSourceKeys].filter(k => !newSourceKeys.has(k) && !stillGrouped.has(k)),
      );

      return prev.map(c => {
        if (c.key === oldKey) return newCol;
        if (fieldsToRestore.has(c.key)) return { ...c, visible: true };
        if (newSourceKeys.has(c.key)) return { ...c, visible: false };
        return c;
      });
    });

    setColumnOrder(prev => (oldKey === newCol.key ? prev : prev.map(k => (k === oldKey ? newCol.key : k))));

    setColumnWidths(prev => {
      if (oldKey === newCol.key) return { ...prev, [newCol.key]: newCol.width };
      const next = { ...prev };
      next[newCol.key] = newCol.width;
      delete next[oldKey];
      return next;
    });

    setColumnVisibility(prev => {
      const next = { ...prev };
      if (oldKey !== newCol.key) delete next[oldKey];
      next[newCol.key] = true;
      if (newCol.dataType === 'composite') {
        newCol.composedOf.forEach(p => {
          next[p.field] = false;
        });
      }
      return next;
    });
  };

  return {
    applyCompositeAdd,
    handleAddCompositeColumn: applyCompositeAdd,
    handleAddCompositeColumnAndContinue: applyCompositeAdd,
    handleDeleteCompositeColumn,
    handleUpdateCompositeColumn,
  };
}
