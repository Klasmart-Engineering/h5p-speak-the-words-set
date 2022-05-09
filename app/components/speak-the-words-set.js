import React from 'react';
import ReactDOM from 'react-dom';
import QuestionSet from './question-set/question-set';
import SolutionScreen from './solution-screen/solution-screen';
import IntroScreen from "./intro-screen/intro-screen";
import Util from './speak-the-words-set-util';
import './speak-the-words-set.css';

/**
 * Speak the Words Set
 * Wraps multiple Speak the Words instances
 */
export default class SpeakTheWordsSet extends React.Component {

  /**
   * Speak the words set
   * @constructor
   * @param {Object} props
   * @param {WrapperClass} props.parent Wrapper reference
   *
   */
  constructor(props) {
    super(props);

    const initialState = props.parent.params.introduction.showIntroPage
      ? viewState.showingIntro
      : viewState.showingQuestions;

    /*
     * Score can only be updated once the component is mounted. When we
     * start with the results, we need to enforce rerendering on mount.
     */
    if (props.previousState && props.previousState.speakTheWordsSet) {
      if (props.previousState.speakTheWordsSet.viewState === viewState.showingResults) {
        this.delayShowingResults = true;
        props.previousState.speakTheWordsSet.viewState = initialState;
      }

      this.state = props.previousState.speakTheWordsSet;
    }
    else {
      this.state = { viewState: initialState, answeredSlides: [] };
    }

    this.queueFocusQuestion = false;

    this.props.parent.eventStore.on('slideAnswered', this.markSlideAsAnswered.bind(this));
    this.props.parent.eventStore.on('showResultsScreen', this.showResultsScreen.bind(this));
    this.props.parent.eventStore.on('xAPIanswered', this.triggerXAPI.bind(this));

    // Allow wrapper to handle Question type contract functions
    props.onInitialized(this);
  }

  /**
   * Run whenever the set is mounted.
   */
  componentDidMount() {
    // Check if all questions have been answered
    if (this.state.answeredSlides.length === this.props.parent.questionInstances.length) {
      this.props.parent.eventStore.trigger('answeredAll');
    }

    // Enforce re-rendering
    if (this.delayShowingResults) {
      this.delayShowingResults = false;
      this.setState({ viewState: viewState.showingResults })
    }

    // Hide retry button that single instances show on showing solutions
    if (this.state.viewState === viewState.showingSolutions) {
      this.props.parent.eventStore.trigger('showSolutions', { keepSlide: true });
    }
  }

  /**
   * Run whenever the set updates.
   */
  componentDidUpdate() {
    this.props.parent.resizeWrapper();

    if (this.queueFocusQuestion) {
      this.props.parent.progressAnnouncers[0].focus();
      this.queueFocusQuestion = false;

      // Make sure to resize since lagging focus could have skewed wrapper
      this.props.parent.resizeWrapper();
    }
  }

  /**
   * Exits introduction screen.
   */
  exitIntroductionScreen() {
    // Queue focusing until after component has updated
    this.queueFocusQuestion = true;
    this.setState({
      viewState: viewState.showingQuestions
    });
  }

  /**
   * Shows solution screen.
   */
  showResultsScreen() {
    this.setState({
      viewState: viewState.showingResults
    });
  }

  /**
   * Resets all questions.
   */
  retry() {
    this.queueFocusQuestion = true;
    this.setState({
      viewState: viewState.showingQuestions,
      answeredSlides: []
    });
    this.props.parent.eventStore.trigger('retrySet');
  }

  /**
   * Show solutions for all questions.
   */
  showSolutions() {
    this.queueFocusQuestion = true;
    this.setState({
      viewState: viewState.showingSolutions
    });
    this.props.parent.eventStore.trigger('showSolutions');
  }

  /**
   * Marks a slide as answered
   * @param {Event} e Triggered event
   * @param {Object} e.data Data of the event
   * @param {number} e.data.slideNumber Slide that was answered
   */
  markSlideAsAnswered(e) {
    const slideNumber = e.data.slideNumber;

    // Skip questions already marked as answered
    if (!this.state.answeredSlides.includes(slideNumber)) {
      const answeredSlides = this.state.answeredSlides.concat([slideNumber]);
      this.setState({
        answeredSlides: answeredSlides
      });

      // Check if all questions have been answered
      if (answeredSlides.length === this.props.parent.questionInstances.length) {
        this.props.parent.eventStore.trigger('answeredAll');
      }
    }
  }

  /**
   * Get latest score.
   * @return {number} latest score.
   */
  getScore() {
    return this.questionSet.getScore();
  }

  /**
   * Get maximum score.
   * @return {number} latest score.
   */
  getMaxScore() {
    return this.questionSet.getMaxScore();
  }

  /**
   * Get current state.
   * @return {object} Current state.
   */
  getCurrentState() {
    return {
      speakTheWordsSet: this.state,
      questionSet: this.questionSet.getCurrentState()
    }
  }

  /**
   * Get xAPI data.
   * @param {object} [wrapper] H5P instance.
   * @return {object} XAPI statement.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  getXAPIData() {
    return ({
      children: this.getXAPIDataFromChildren(),
      statement: this.getXAPIAnswerEvent(this.props.parent).data.statement
    });
  }

  /**
   * Trigger xAPI answered event.
   */
  triggerXAPI() {
    // Let xAPI event of children trigger first
    setTimeout(() => {
      const xAPIData = this.getXAPIData();
      const xAPIEvent = new H5P.XAPIEvent();
      xAPIEvent.data.children = xAPIData.children;
      xAPIEvent.data.statement = xAPIData.statement;

      this.props.parent.trigger(xAPIEvent);
    }, 0);
  }

  /**
   * Get xAPI data from children.
   * @return {object} XAPIData from children.
   */
  getXAPIDataFromChildren() {
    return this.questionSet.getXAPIDataFromChildren();
  }

  /**
   * Build xAPI answer event.
   * @param {object} wrapper H5P instance.
   * @return {H5P.XAPIEvent} XAPI answer event.
   */
  getXAPIAnswerEvent(wrapper) {
    const xAPIEvent = this.createXAPIEvent('answered', wrapper);

    xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), wrapper,
      true, this.getScore() === this.getMaxScore());

    return xAPIEvent;
  }

  /**
   * Create an xAPI event for SpeakTheWords.
   * @param {string} verb Short id of the verb we want to trigger.
   * @param {object} wrapper H5P instance.
   * @return {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb, wrapper = {}) {

    const xAPIEvent = new H5P.XAPIEvent();

    xAPIEvent.setActor();
    xAPIEvent.setVerb(verb);
    xAPIEvent.setObject(wrapper);
    xAPIEvent.setContext(wrapper);

    Util.extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition());
    return xAPIEvent;
  }

  /**
   * Get the xAPI definition for the xAPI object.
   * @return {object} XAPI definition.
   */
  getxAPIDefinition() {
    return ({
      name: {'en-US': H5P.createTitle('Speak the Words Set')},
      description: {'en-US': ''},
      type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
      interactionType: 'compound'
    });
  }

  /**
   * Get reference to QuestionSet object.
   * @param {object} QuestionSet object.
   */
  handleInitialized(questionSet) {
    this.questionSet = questionSet;
  }

  /**
   * Renders the component.
   * @returns {XML}
   */
  render() {
    let introScreen = null;
    if (this.state.viewState === viewState.showingIntro) {
      introScreen = (
        <IntroScreen
          exitIntroductionScreen={this.exitIntroductionScreen.bind(this)}
          parent={this.props.parent}
        />
      );
    }

    let solutionScreen = null;
    if (this.state.viewState === viewState.showingResults) {
      const currentScore = this.props.parent.questionInstances.reduce((val, question) => {
        return val + question.getScore();
      }, 0);

      solutionScreen = (
        <SolutionScreen
          currentScore={currentScore}
          maxScore={this.props.parent.params.questions.length}
          retry={this.retry.bind(this)}
          showingResults={viewState.showingResults}
          showSolutions={this.showSolutions.bind(this)}
          parent={this.props.parent}
        />
      );
    }

    return (
      <div>
        {introScreen}
        <QuestionSet
          showingQuestions={
            this.state.viewState === viewState.showingQuestions ||
            this.state.viewState === viewState.showingSolutions
          }
          previousState={this.props.previousState.questionSet}
          answeredSlides={this.state.answeredSlides}
          parent={this.props.parent}
          onInitialized={this.handleInitialized.bind(this)}
        />
        {solutionScreen}
      </div>
    );
  }
}

/**
 * The different states that the set can be in
 * @typedef {Object} ViewStates
 * @property {number} showingIntro Showing introduction screen
 * @property {number} showingQuestions Showing one of the questions in the set
 * @property {number} showingResults Showing results screen.
 * @property {number} showingSolutions Showing solutions
 */
const viewState = {
  showingIntro: 0,
  showingQuestions: 1,
  showingResults: 2,
  showingSolutions: 3
};
