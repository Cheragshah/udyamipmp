// CSV Export utility functions

export const downloadCSV = (data: Record<string, unknown>[], filename: string, headers: Record<string, string>) => {
  if (data.length === 0) return;

  const headerKeys = Object.keys(headers);
  const headerLabels = Object.values(headers);

  const csvContent = [
    headerLabels.join(','),
    ...data.map(row => 
      headerKeys.map(key => {
        const value = row[key];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value ?? '');
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const formatDateForExport = (dateString: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
};
