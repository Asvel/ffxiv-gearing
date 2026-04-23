import * as React from 'react';
import classNames from 'clsx';
import { Button } from '../@rmwc/button';
import { Badge } from '../@rmwc/badge';
import { useStore } from './contexts';

type Props<T> = T extends (props: infer P, ...args: never[]) => any ? P : never;

export interface BadgeButtonProps extends Props<typeof Button> {
  promotion: string,
}

export const BadgeButton = React.memo<BadgeButtonProps>(props => {
  const { promotion, className, onClick, children, ...rest } = props;
  const store = useStore();
  return (
    <Button
      {...rest}
      className={classNames(className, 'badge-button')}
      onClick={() => {
        store.promotion.off(promotion);
        return onClick();
      }}
    >
      {children}
      <Badge className="badge-button_badge" exited={!store.promotion.get(promotion)} />
    </Button>
  );
});
