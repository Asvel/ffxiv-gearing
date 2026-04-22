import * as RMWC from '../types';
import React from 'react';
import classNamesFunc from 'clsx';
import { FoundationElement } from './foundation-component';

type ClassNamesInputT<Props> =
  | undefined
  | ((
      props: Props
    ) => Array<
      | string
      | undefined
      | null
      | { [className: string]: boolean | undefined | string | number }
    >)
  | string[]
  | Array<
      | string
      | undefined
      | null
      | { [className: string]: boolean | undefined | string | number }
    >;

export function Tag({ tag: TagEl = 'div', theme, element, ref, ...rest }: {
  element?: FoundationElement<any, any>;
} & RMWC.HTMLProps<any, any>) {
  const finalProps = element ? element.props(rest) : rest;
  const finalRef = element ? mergeRefs(ref, element.reactRef) : ref;

  return <TagEl {...finalProps} ref={finalRef} />;
}

export const useClassNames = <Props extends { [key: string]: any }>(
  props: Props,
  classNames: ClassNamesInputT<Props>
) => {
  return classNamesFunc(
    props.className,
    // @ts-ignore
    ...(typeof classNames === 'function' ? classNames(props) : classNames)
  );
};

export const mergeRefs =
  (...refs: Array<React.Ref<any> | undefined | null>) =>
  (el: any) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref && 'current' in ref) {
        ref.current = el;
      }
    }
  };

export const handleRef = <T,>(
  ref: React.Ref<T> | null | undefined,
  value: T
) => {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref && 'current' in ref) {
    ref.current = value;
  }
};

export function createComponent<
  P extends {},
  ElementP extends {} = React.HTMLProps<HTMLElement>
>(Component: React.FunctionComponent<P & ElementP>) {
  // Interestingly enough, we only need this declaration
  // for a generic placeholder for typescript inference,
  // we don't actually have to pay the penalty for using it at runtime :)
  const WrappedComponent = <Tag extends React.ElementType = 'div'>(
    props: RMWC.ComponentProps<P, ElementP, Tag>,
  ) => {
    return <></>;
  };

  WrappedComponent.displayName = Component.name || 'RMWCComponent';
  Component.displayName = WrappedComponent.displayName;

  return Component as typeof WrappedComponent;
}

export function createMemoComponent<
  P extends {},
  ElementP extends {} = React.HTMLProps<HTMLDivElement>
>(Component: React.FunctionComponent<P & ElementP>) {
  const Comp = createComponent<P, ElementP>(Component);
  return React.memo(Comp) as typeof Comp;
}
