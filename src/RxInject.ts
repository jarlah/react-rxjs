import * as React from "react"
import { Observable, Subscription } from "rxjs"
import { render } from "./JsxHelper"
import { Store, PropsType, Injector } from "./RxTypes"
import { DevToolsInstance, getExtension, isRelevant } from "./DevTools"

export default function inject<ComponentProps, StoreProps, ParentProps>(
  store: Store<ParentProps, StoreProps>,
  props: PropsType<ComponentProps, StoreProps, ParentProps>
): Injector<ComponentProps, ParentProps> {
  return (Component: React.ComponentType<ComponentProps>) => {
    type State = { store: StoreProps }
    class Inject extends React.Component<ParentProps, State> {
      state: State
      storeSubscription: Subscription
      devToolsSubscription: () => void
      devTools: DevToolsInstance

      componentWillMount() {
        const devToolsExt = getExtension()
        if (devToolsExt) {
          this.devTools = devToolsExt.connect()
          this.devToolsSubscription = this.devTools.subscribe(message => {
            if (isRelevant(message)) {
              const props: StoreProps = JSON.parse(message.state)
              this.setState({ store: props })
            }
          })
        }
      }

      sendToDevTools(store: StoreProps) {
        this.devTools && this.devTools.send("update", store)
      }

      updateState(store: StoreProps) {
        this.setState({ store })
      }

      componentDidMount() {
        this.storeSubscription = getObservable(store, this.props)
          .do(this.sendToDevTools.bind(this))
          .do(this.updateState.bind(this))
          .subscribe()
      }

      componentWillUnmount() {
        this.storeSubscription.unsubscribe()
        const devToolsExt = getExtension()
        if (devToolsExt) {
          this.devToolsSubscription()
          devToolsExt.disconnect()
        }
      }

      render() {
        if (!this.state) {
          return null
        }
        const customProps =
          typeof props === "function"
            ? props(this.state.store, this.props)
            : props
        return render(Component, customProps)
      }
    }
    return Inject
  }
}

function getObservable<P, T>(store: Store<P, T>, parentPops: P): Observable<T> {
  return store instanceof Observable
    ? store as Observable<T>
    : typeof store === "function" ? store(parentPops) : store as Observable<T>
}
