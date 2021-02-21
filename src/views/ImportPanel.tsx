import * as mobxReact from 'mobx-react-lite';

export const ImportPanel = mobxReact.observer(() => {
  return (
    <div className="import card">
      <div className="import_title">使用方法：</div>
      <div>将下方的链接添加为浏览器书签（一种较方便的方式是拖拽下方链接至书签栏），</div>
      <div>然后打开想导入的配装所在的页面，点击此书签。</div>
      <a
        ref={r => r?.setAttribute('href', encodeURI(
          `javascript:void(document.body.appendChild(document.createElement('script')).src='`
          + window.location.origin + window.location.pathname + `import.js?'+Math.random())`))}
        className="import_bookmarklet"
        onClick={e => e.preventDefault()}
        children="导入配装"
      />
      <div className="import_title">目前支持从以下配装器导入：</div>
      <div>Ariyala&apos;s Final Fantasy XIV Toolkit (ffxiv.ariyala.com)</div>
      <div>FF14俺tools：装備シミュレータ (ffxiv.es.exdreams.net)</div>
      <div>Etro (etro.gg)</div>
      <div>FFXIV Teamcraft (ffxivteamcraft.com)</div>
      <div className="import_warn">此功能可能因上述站点的设计变动而失效，如遇到不可用请反馈。</div>
    </div>
  );
});
