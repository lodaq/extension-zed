import * as React from "react"
import type { ToastProps } from "./toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000

type ToastItem = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
}

type State = {
  toasts: ToastItem[]
}

type Action =
  | { type: "ADD_TOAST"; toast: ToastItem }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string }

const listeners: Array<(state: State) => void> = []
const removalTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
let memoryState: State = { toasts: [] }
let toastId = 0

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((item) =>
          action.toastId === undefined || item.id === action.toastId
            ? { ...item, open: false }
            : item
        ),
      }
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: action.toastId === undefined
          ? []
          : state.toasts.filter((item) => item.id !== action.toastId),
      }
  }
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

function removeToastLater(id: string) {
  if (removalTimeouts.has(id)) return
  removalTimeouts.set(
    id,
    setTimeout(() => {
      removalTimeouts.delete(id)
      dispatch({ type: "REMOVE_TOAST", toastId: id })
    }, TOAST_REMOVE_DELAY)
  )
}

export function toast(props: Omit<ToastItem, "id">) {
  const id = String(++toastId)
  const dismiss = () => {
    dispatch({ type: "DISMISS_TOAST", toastId: id })
    removeToastLater(id)
  }

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return { id, dismiss }
}

export function useToast() {
  const [state, setState] = React.useState(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index !== -1) listeners.splice(index, 1)
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (id?: string) => {
      dispatch({ type: "DISMISS_TOAST", toastId: id })
      if (id) removeToastLater(id)
    },
  }
}