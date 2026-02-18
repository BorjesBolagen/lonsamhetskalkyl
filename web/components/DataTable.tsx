export default function DataTable() {
  return (
    <div className="w-full">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2">Kolumn 1</th>
            <th className="border border-gray-300 px-4 py-2">Kolumn 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-300 px-4 py-2">Data</td>
            <td className="border border-gray-300 px-4 py-2">Data</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}