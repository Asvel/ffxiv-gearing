import * as mobxReact from 'mobx-react-lite';

export const About = mobxReact.observer(() => {
  return (
    <div className="about">
      <span className="about_name">最终幻想14配装器</span>
      <span className="about_version">2307b</span>
      <span className="about_separator">·</span>
      <a
        className="about_link"
        href="https://github.com/Asvel/ffxiv-gearing/blob/master/CHANGELOG.md"
        target="_blank"
        children="更新记录"
      />
      <span className="about_separator">·</span>
      <a
        className="about_link"
        href="https://github.com/Asvel/ffxiv-gearing#license"
        target="_blank"
        children="许可协议"
      />
      <span className="about_separator">·</span>
      <a
        className="about_link"
        href="https://github.com/Asvel/ffxiv-gearing"
        target="_blank"
        children="源代码"
      />
    </div>
  );
});
