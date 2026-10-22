import { createContext, useContext, useState } from 'react'

// Factory dùng chung cho các entity có CRUD giống nhau (Students, Lecturers, Companies...)
// Tránh viết lặp lại cùng 1 logic add/update/delete/kiểm tra trùng ở nhiều context.
export function createResourceContext(initialItems, name) {
  const Context = createContext(null)

  function Provider({ children }) {
    const [items, setItems] = useState(initialItems)

    function getById(id) {
      return items.find((item) => item.id === Number(id))
    }

    function addItem(data) {
      const newId = Math.max(0, ...items.map((item) => item.id)) + 1
      const newItem = { id: newId, ...data }
      setItems((prev) => [...prev, newItem])
      return newItem
    }

    function updateItem(id, changes) {
      setItems((prev) =>
        prev.map((item) => (item.id === Number(id) ? { ...item, ...changes } : item)),
      )
    }

    function deleteItem(id) {
      setItems((prev) => prev.filter((item) => item.id !== Number(id)))
    }

    // Kiểm tra trùng giá trị của 1 field (ví dụ student_code, tax_code) — dùng cho validate form
    function isFieldTaken(field, value, ignoreId) {
      return items.some((item) => item[field] === value && item.id !== ignoreId)
    }

    const value = { items, getById, addItem, updateItem, deleteItem, isFieldTaken }

    return <Context.Provider value={value}>{children}</Context.Provider>
  }

  function useResource() {
    const context = useContext(Context)
    if (!context) {
      throw new Error(`use${name} phải được dùng bên trong ${name}Provider`)
    }
    return context
  }

  return { Provider, useResource }
}
