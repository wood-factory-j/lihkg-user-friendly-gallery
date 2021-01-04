// ==UserScript==
// @name         LIHKG User Friendly Gallery Mode
// @namespace
// @version      0.1.0
// @description  Remember and auto-scroll to the last viewed image position in gallery mode
// @author       木廠仔, inspired by python3 巴打
// @match        *://lihkg.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const Selectors = {
    ROOT: '#app',
    IMAGE: 'div[data-row] div[data-src]',
    IMAGE_WITH_URL: url => `div[data-row] div[data-src='${url}']`,
    ICON_ARROW_LEFT: '.i-arrow-round-left',
    ICON_ARROW_RIGHT: '.i-arrow-round-right',
    ICON_SEARCH_MAGNIFY: '.i-image-search-magnify',
  };
  const Styles = {
    BORDER_INITIAL: '',
    INSET_INITIAL: '4px',
    TRANSFORM_INITIAL: '',
    TRANSITION_INITIAL: 'opacity .1s linear',
    BORDER: '4px solid #fbc308',
    INSET: '0px',
    TRANSFORM: 'scale(0.5)',
    TRANSITION: 'all 0.3s',
  };
  const SCROLL_OFFSET_FOR_HEADER = 80;
  const STORAGE_KEY = 'TM_LUFGM';
  const MODES = {
    DEFAULT: 'DEFAULT',
    GALLERY: 'GALLERY',
    SINGLE_IMAGE: 'SINGLE_IMAGE',
  };

  // LIHKG removed localStorage's reference from the window object for some reason
  // Need to obtain a reference to the localStorage before deletion
  const localStorageRef = window.localStorage;

  let prevMode = MODES.DEFAULT;

  /**
   * main
   */
  new MutationObserver(() => {
    const mode = getMode();

    if (prevMode === mode) {
      return;
    }

    if (prevMode === MODES.SINGLE_IMAGE) {
      document.removeEventListener('keydown', handleKeyDown);
    }

    switch (mode) {
      case MODES.GALLERY: {
        attachGalleryImageListeners();

        if (prevMode === MODES.DEFAULT) {
          scrollToImage();
        }
        if (!isWithinViewport(getCurrentImage())) {
          scrollToImage({ animatedScroll: true, withTransition: false });
        }

        break;
      }

      case MODES.SINGLE_IMAGE: {
        attachSingleImageListeners();
        break;
      }
    }

    prevMode = mode;
  }).observe(document.querySelector(Selectors.ROOT), {
    subtree: true,
    childList: true,
  });

  /**
   * listeners
   */
  function attachGalleryImageListeners() {
    const imageNodes = document.querySelectorAll(Selectors.IMAGE);

    imageNodes.forEach(node => {
      node.addEventListener('click', handleClickImage);
    });
  }

  function attachSingleImageListeners() {
    const leftButton = document.querySelector(Selectors.ICON_ARROW_LEFT);
    const rightButton = document.querySelector(Selectors.ICON_ARROW_RIGHT);

    document.addEventListener('keydown', handleKeyDown);

    if (leftButton) {
      leftButton.parentElement.addEventListener('click', handleClickLeftButton);
    }

    if (rightButton) {
      rightButton.parentElement.addEventListener(
        'click',
        handleClickRightButton,
      );
    }
  }

  /**
   * event handlers
   */
  function handleClickImage(event) {
    const targetImage = event.target;

    updateStyles(event.target);
    saveImageUrlToLocalStorage(STORAGE_KEY, targetImage.dataset.src);
  }

  function handleClickLeftButton() {
    const previousImage = getPreviousImage();

    updateStyles(previousImage);
    saveImageUrlToLocalStorage(STORAGE_KEY, previousImage.dataset.src);
  }

  function handleClickRightButton() {
    const nextImage = getNextImage();

    updateStyles(nextImage);
    saveImageUrlToLocalStorage(STORAGE_KEY, nextImage.dataset.src);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowRight') {
      handleClickRightButton();
    }
    if (event.key === 'ArrowLeft') {
      handleClickLeftButton();
    }
  }

  /**
   * helpers
   */
  function getMode() {
    if (isInSingleImageMode()) {
      return MODES.SINGLE_IMAGE;
    }

    if (isInGalleryMode()) {
      return MODES.GALLERY;
    }

    return MODES.DEFAULT;
  }

  function isInGalleryMode() {
    return (
      document.querySelector(Selectors.IMAGE) !== null &&
      document.querySelector(Selectors.ICON_SEARCH_MAGNIFY) === null
    );
  }

  function isInSingleImageMode() {
    return (
      prevMode !== MODES.DEFAULT &&
      document.querySelector(Selectors.ICON_SEARCH_MAGNIFY) !== null
    );
  }

  function isWithinViewport(element) {
    if (!element) {
      return false;
    }

    const viewportHeight = window.innerHeight;
    const { y, height } = element.getBoundingClientRect();

    return y >= 80 && y <= viewportHeight - height;
  }

  function scrollToImage(config = {}) {
    const { animatedScroll = false, withTransition = true } = config;
    const lastViewedImage = getCurrentImage();

    if (lastViewedImage) {
      const imageRow = lastViewedImage.parentElement.parentElement;
      const scrollContainer = imageRow.parentElement;

      styleImage(lastViewedImage);

      if (withTransition) {
        transitionImageStyle(lastViewedImage);
      }

      scrollContainer.scrollTo({
        left: 0,
        top: Math.max(0, imageRow.offsetTop - SCROLL_OFFSET_FOR_HEADER),
        behavior: animatedScroll ? 'smooth' : 'auto',
      });
    }
  }

  function getCurrentImage() {
    const lastViewedImageUrl = getImageUrlFromLocalStorage(STORAGE_KEY);

    return document.querySelector(Selectors.IMAGE_WITH_URL(lastViewedImageUrl));
  }

  function getNextImage() {
    const lastViewedImage = getCurrentImage();

    if (!lastViewedImage) {
      return;
    }

    const imageWrapper = lastViewedImage.parentElement;
    const imageRow = imageWrapper.parentElement;
    const nextImageWrapper = imageWrapper.nextElementSibling;
    const nextRowFirstChild = imageRow.nextElementSibling.firstElementChild;

    return nextImageWrapper
      ? nextImageWrapper.querySelector('div')
      : nextRowFirstChild.querySelector('div');
  }

  function getPreviousImage() {
    const lastViewedImage = getCurrentImage();

    if (!lastViewedImage) {
      return;
    }

    const imageWrapper = lastViewedImage.parentElement;
    const imageRow = imageWrapper.parentElement;
    const previousImageWrapper = imageWrapper.previousElementSibling;
    const previousRowFirstChild =
      imageRow.previousElementSibling.lastElementChild;

    return previousImageWrapper
      ? previousImageWrapper.querySelector('div')
      : previousRowFirstChild.querySelector('div');
  }

  function getPostId() {
    return window.location.pathname.split('/')[2];
  }

  /**
   * styling
   */
  function updateStyles(targetImage) {
    const imageNodes = document.querySelectorAll(Selectors.IMAGE);

    resetAllImageStyle(imageNodes);
    styleImage(targetImage);
  }

  function resetAllImageStyle(images) {
    images.forEach(function (node) {
      node.style.border = Styles.BORDER_INITIAL;
      node.style.inset = Styles.INSET_INITIAL;
    });
  }

  function styleImage(image) {
    image.style.border = Styles.BORDER;
    image.style.inset = Styles.INSET;
  }

  function transitionImageStyle(image) {
    const handleTransitionEnd = event => {
      if (event.propertyName === 'transform') {
        image.style.transition = Styles.TRANSITION_INITIAL;
        image.removeEventListener('transitionend', handleTransitionEnd);
      }
    };

    requestAnimationFrame(() => {
      image.style.transform = Styles.TRANSFORM;

      requestAnimationFrame(() => {
        image.style.transition = Styles.TRANSITION;
        image.style.transform = Styles.TRANSFORM_INITIAL;
        image.addEventListener('transitionend', handleTransitionEnd);
      });
    });
  }

  /**
   * persistence
   */
  function saveImageUrlToLocalStorage(key, value) {
    const postId = getPostId();
    const prevData = getFromLocalStorage(key);

    prevData[postId] = value;
    localStorageRef.setItem(key, JSON.stringify(prevData));
  }

  function getImageUrlFromLocalStorage(key) {
    const postId = getPostId();
    const storageData = getFromLocalStorage(key);

    return storageData[postId];
  }

  function getFromLocalStorage(key) {
    return JSON.parse(localStorageRef.getItem(key)) || {};
  }
})();
