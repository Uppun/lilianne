import React from 'react';
import Guild from './Guild';
import {UserAvatar} from './DiscordIcon';
import {CSSTransitionGroup} from 'react-transition-group';

export default class ErrorScreenWrapper extends React.Component {
  renderNoAuth() {
    return (
      <ErrorScreen header="Huh?!">
        <section>
          <p>Well, this is embarrassing. I don't know how you got here!</p>
          <p>This isn't normal at all, so I'm not really sure how to proceed...</p>
          <p>Maybe try refreshing? Let's hope for the best!</p>
        </section>
      </ErrorScreen>
    );
  }

  renderDisconnected() {
    return (
      <ErrorScreen header="Disconnected!">
        <section>
          <p>Sorry! I might have gone to sleep for the night!</p>
          <p>If you know I'm supposed to be awake, try giving this page a refresh!</p>
        </section>
      </ErrorScreen>
    );
  }

  renderNoAccess() {
    return (
      <ErrorScreen
        header="Access denied!"
        footer={
          <form method="POST" action="logout">
            <button className="primary" type="submit">
              Re-authenticate
            </button>
          </form>
        }>
        <div>
          <section>
            You need to be on:
            <Guild />
            {/* TODO */}
          </section>
          <section>
            You are logged in as:
            <div className="member">
              <UserAvatar user={data.user.id} avatar={data.user.avatar} />
              <div className="member-inner">
                <div className="member-username">
                  <span className="member-username-inner">{data.user.username}</span>
                </div>
                <span className="member-discriminator">#{data.user.discriminator}</span>
              </div>
            </div>
          </section>
          <section>
            <p>
              <strong>If this is the correct account</strong>, you're out of luck, buddy.
            </p>
            <p>
              <strong>If this is the wrong account</strong>,{' '}
              <a href="https://discordapp.com/channels/@me">open Discord in your browser</a> and log into the correct
              account. Then click the button below.
            </p>
          </section>
        </div>
      </ErrorScreen>
    );
  }

  renderNoConnection() {
    return (
      <ErrorScreen header="I fell asleep!">
        <section>
          <p>Give me a couple of seconds to wake up, then try refreshing the page!</p>
        </section>
      </ErrorScreen>
    );
  }

  renderErrorScreen(props) {
    const {type, data} = props;

    if (!type || type === 'none') return null;

    switch (type) {
      case 'not authenticated':
        return this.renderNoAuth();
      case 'not connected':
        return this.renderNoConnection();
      case 'not in server':
        return this.renderNoAccess();
      case 'disconnected':
        return this.renderDisconnected();
      default:
        return null;
    }
  }
  render() {
    return (
      <CSSTransitionGroup
        transitionName="fadeError"
        transitionEnterTimeout={500}
        transitionLeaveTimeout={500}
        transitionAppear
        transitionAppearTimeout={500}>
        {this.renderErrorScreen(this.props)}
      </CSSTransitionGroup>
    );
  }
}
class ErrorScreen extends React.Component {
  render() {
    if (!this.props) return null;

    return (
      <div>
        <div className="front flex-vertical flex-spacer">
          <div className="application-icon">
            <div className="application-icon-inner" />
          </div>
          <div className="front-inner">
            <header>
              <h1>{this.props.header}</h1>
            </header>
            <div className="scroller-wrap">
              <div className="details scroller">{this.props.children}</div>
            </div>
            <footer>{this.props.footer}</footer>
          </div>
        </div>
      </div>
    );
  }
}
