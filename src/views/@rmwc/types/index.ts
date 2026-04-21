/**
 * Theming
 */
export type ThemeOptionT =
  | 'primary'
  | 'secondary'
  | 'background'
  | 'surface'
  | 'error'
  | 'primaryBg'
  | 'secondaryBg'
  | 'onPrimary'
  | 'onSecondary'
  | 'onSurface'
  | 'onError'
  | 'textPrimaryOnBackground'
  | 'textSecondaryOnBackground'
  | 'textHintOnBackground'
  | 'textDisabledOnBackground'
  | 'textIconOnBackground'
  | 'textPrimaryOnLight'
  | 'textSecondaryOnLight'
  | 'textHintOnLight'
  | 'textDisabledOnLight'
  | 'textIconOnLight'
  | 'textPrimaryOnDark'
  | 'textSecondaryOnDark'
  | 'textHintOnDark'
  | 'textDisabledOnDark'
  | 'textIconOnDark'
  | undefined;

export type ThemePropT = ThemeOptionT | ThemeOptionT[];

/**
 * Ripples
 */
export type RipplePropT =
  | boolean
  | {
      accent?: boolean;
      surface?: boolean;
      unbounded?: boolean;
    };

export interface WithRippleProps {
  /** Adds a ripple effect to the component */
  ripple?: RipplePropT;
}

/**
 * Components
 */
export type TagT = string | React.ComponentType<any>;

export type CustomEventT<T> = CustomEvent<T> &
  React.SyntheticEvent<EventTarget>;

export type IconPropT = React.ReactElement;

export type HTMLProps<T = HTMLElement, A = React.AllHTMLAttributes<T>> = A &
  React.ClassAttributes<T> & {
    tag?: TagT;
    theme?: ThemePropT;
    ref?: React.HTMLProps<T>['ref'];
  };

export type ComponentProps<
  Props extends {},
  ElementProps extends {},
  Tag extends React.ElementType
> = Props &
  (
    | ElementProps
    | (React.ComponentPropsWithRef<Tag> & {
        tag?: Tag;
        theme?: ThemePropT;
      })
  );

export type ComponentType<
  Props extends {},
  ElementProps extends {},
  Element extends React.ElementType<any>
> = {
  <Tag extends React.ElementType<any> = Element>(
    props: ComponentProps<Props, ElementProps, Tag>,
    ref: any
  ): JSX.Element;
  displayName?: string;
};
