/*
 Things to note:
 
  * centerFocus and even number of items per page are not supported.
  * Per-item button scrolling always focuses the element (so if this is used, need to apply a focus class style to the elements).
  
 LazyLoader Addition
 -------------------
  
  * Don't forget to include lazyloader.js!
  * If used with lazy loader, Sequence needs to be created on dom:loaded
  * lazyLoadType can be 'page' or 'item'
  * lazyLoadThreshold is the number of pages or items to look ahead (based on the lazyLoadType)
  * eg. lazyLoadType = 'page' and lazyLoadThreshold = 2, then it'll preload 2 pages ahead
  * eg. lazyLoadType = 'item' and lazyLoadThreshold = 3, then it'll preload 3 items ahead
*/




var Sequence = Class.create({
    // Changed how we normally define default options
    options: {
        scrollSnap: true,
        centerFocus: true,
        focusedClass: "focused",
        containerClass: "container",
        orientation: "horizontal",
        firstClass: "first",
        lastClass: "last",
        autoScroll: true,
        autoScrollType: "per-item",                     // per-page or per-item
        autoScrollDelay: 5,
        autoScrollFinishAction: "reverse",              // reverse or rewind
        focusOnClick: true,
        enableClickEvents: false,
        nextPageClass: "next-page",
        previousPageClass: "previous-page",
        nextDisabledClass: "next-disabled",
        previousDisabledClass: "previous-disabled",
        pagingType: "per-item",                         // per-page or per-item
        pagingLoop: true,                               // if per-item and true, then paging loops per item
        keyScrollType: "per-item-and-focus",            // per-page, per-item or per-item-and-focus
        keyScrollLoop: true,
        useKeyScroll: true,
        smoothScroll: true,                             // new option: if false, then scrolling just "snaps"
        scrollDuration: 1,
        useMouseStop: false,
        pausedClass: 'paused',
        pausedText: 'Paused',
        showPauseIndicator: true,
        iePNGFix: true,
        // Lazy Loader options
        
        lazyLoader: null,
        lazyLoadType: "item",                           // page or item
        lazyLoadThreshold: 1                            // the amount of look ahead based on the above type 
    },
    
    initialize: function(wrapper, selector, options) {
        this.options = Object.extend(Object.extend({}, this.options), options || {});
        
        // if no wrapper found then die
        this.wrapper = $(wrapper);
        if (this.wrapper == null) return;
        
        // if no items then die
        var elements = $$(selector);
        if (elements.length == 0) return;
        
        this.focusEvents = [];
        
        // find the container
        this.container = this.wrapper.getElementsBySelector("." + this.options.containerClass).first();
        
        // setup the lazy load, only works if sequence is created on dom:loaded
        // use lazy loader to load images only if specified in the options
        this.setupLazyLoader();
        
        this.setupContainer();
        this.setupElements(elements);
        this.setupPageButtons();
        this.setupKeyScroll();
        this.setupMousePause();
        
        this.direction = "next";
        
        // show any images that are visible on load
        this.setLazyLoaderThreshold();
        
        this.scrollToElement(this.elements.first(), true, true);
        
        this.updateLazyLoader();
    },
        
    addFocusEvent: function(func) {    
        if (this.focusEvents) {
            this.focusEvents.push(func);
        }
    },
    
    setupMousePause: function() {
        if (this.options.useMouseStop && this.options.autoScroll) {
            this.container.observe("mouseover", this.mouseEnter.bind(this)(this.containerEnter.bindAsEventListener(this)));
            this.container.observe("mouseout", this.mouseEnter.bind(this)(this.containerLeave.bindAsEventListener(this)));  
            
            // add pause notifier only if mouse stop is on        
            if (this.options.showPauseIndicator) {
                this.pauseDiv = new Element("div", { 'class': this.options.pausedClass }).update(this.options.pausedText);
                this.container.appendChild(this.pauseDiv);
                this.pauseDiv.hide();
            }
        }
    },
    
    pause: function() {
        this.paused = true;
        this.pauseDiv.show();     
    },
    
    unpause: function() {
        this.paused = false;
        
        clearTimeout(this.timer);
        this.startAutoScroll(this.currentElement);
        this.pauseDiv.hide();
    },
    
    containerEnter: function() {
        this.pause();
    },
    
    containerLeave: function() {
        this.unpause();
    },
    
    mouseEnter: function(handler) {
        return function(event) {
            var relatedTarget = event.relatedTarget;
            if (relatedTarget == null) return;
            if (!relatedTarget.descendantOf) return;

            if (this === relatedTarget || relatedTarget.descendantOf(this)) return;
            handler.call(this, event);
        }
    },
    
    setLazyLoaderThreshold: function() {
        if (this.lazyLoader && this.lazyLoader.container != null) {        
            var threshold;
        
            // find the threshold in pixels based on lazy load type
            switch (this.options.lazyLoadType) {
                case "page":
                    threshold = this.options.lazyLoadThreshold * this.container.getWidth();
                    break;
                case "item":
                    threshold = this.options.lazyLoadThreshold * this.maxSize;
                    break;
            }
        
            this.lazyLoader.setThreshold(threshold);
        }
    },
    
    updateLazyLoader: function() {
        if (this.lazyLoader && this.lazyLoader.container != null) {
            this.lazyLoader.update();
        }
    },
    
    setupLazyLoader: function() {
        if (this.options.lazyLoader) {
            this.lazyLoader = this.options.lazyLoader;
        }
    },
    
    setupKeyScroll: function() {
        if (!this.options.useKeyScroll) return;
        
        $(document).observe("keydown", this.keyScroll.bindAsEventListener(this));  
    },
    
    setupContainer: function() {
        this.container.setStyle({ position: "relative", overflow: "hidden" });
        this.holder = new Element("div");
        this.holder.setStyle({ position: "absolute" });
        this.container.appendChild(this.holder);
        
        // depending on orientation set starting size
        if (this.options.orientation == "horizontal") {
            this.holder.setStyle({ width: 0 });
        } else {
            this.holder.setStyle({ height: 0 });            
        }
    },
    
    widthOrHeight: function() {
        // alter width or height depending on orientation
        if (this.options.orientation == "horizontal") {
            return "width";
        } else {
            return "height";
        }
    },
    
    currentHolderSize: function() {
        // depending on orientation set starting size
        return parseInt(this.holder.getStyle(this.widthOrHeight()));
    },
    
    setHolderSize: function(size) {
        var hashStyle = {};        
        hashStyle[this.widthOrHeight()] = size + "px";
        this.holder.setStyle(hashStyle);
    },
    
    setupElements: function(elements) {
        this.elements = [];
        
        // add in first and last classes
        elements.first().classNames().add(this.options.firstClass);
        elements.last().classNames().add(this.options.lastClass);
        
        // setup the elements
        elements.each(function(element) {
            this.elements.push(new Sequence.Element(element, this, this.options));
        }.bind(this));
        
        // setup looping if required
        if (this.options.autoScrollFinishAction == "rewind") {
            this.elements.first().previousElement = this.elements.last();
            this.elements.last().nextElement = this.elements.first();
        }
        
        // setup looping for paging buttons
        if (this.options.pagingLoop) {
            this.elements.first().previousElementPaging = this.elements.last();
            this.elements.last().nextElementPaging = this.elements.first();
        }
        
        // setup looping for paging buttons
        if (this.options.keyScrollLoop) {
            this.elements.first().previousElementKeyScroll = this.elements.last();
            this.elements.last().nextElementKeyScroll = this.elements.first();
        }
        
        if (this.options.orientation == "horizontal") {
            this.containerSize = this.container.getWidth();
            this.holderSize = this.holder.getWidth();
            
            // left and right keys for scrolling
            this.previousKey = 37;
            this.nextKey = 39;
        } else {
            this.containerSize = this.container.getHeight();
            this.holderSize = this.holder.getHeight();

            // up and down keys for scrolling            
            this.previousKey = 38;
            this.nextKey = 40;
        }
    },
    
    checkDirection: function(element) {
        if (!this.options.autoScroll) return;
        
        // check direction and change if neccessary
        if (this.options.autoScrollFinishAction == "reverse") {
            if (this.options.autoScrollType == "per-page") {
                if (this.direction == "previous" && this.scrollPosition <= 0) {
                    this.direction = "next";
                } else if (this.direction == "next" && this.scrollPosition >= this.holderSize - this.containerSize) {
                    this.direction = "previous";
                }
            } else if (this.options.autoScrollType == "per-item") {
                if (this.direction == "previous" && element.previousElement == null) {
                    this.direction = "next";
                }
                else if (this.direction == "next" && element.nextElement == null) {
                    this.direction = "previous";
                }
            }
        }
    },
    
    scrollToElement: function(element, centerIt, focusIt) {
        if (element == null) return;
        if (this.paused) return;
        
        if (focusIt) {
            this.focusElement(element);
        }
        
        // stop any previous autoscrolling
        if (this.timer) {
            clearTimeout(this.timer);
        }
        
        var domElement = element.element;
        
        // find position of element relative to the holder div
        var relativeOffset = domElement.positionedOffset();
        
        // now move it
        if (this.effect != null) this.effect.cancel();
        
        if (this.options.orientation == "horizontal") {
            var offset = relativeOffset[0];
            if (centerIt && this.options.centerFocus) {
                offset -= (this.containerSize - element.size.width) / 2;
                
                // if scroll snap on then make sure no clipping occurs
                if (this.options.scrollSnap) {
                    var newElement = this.elementCloseTo(offset);
                    offset = newElement.element.positionedOffset()[0];
                }
            }
            
            this.scrollTo(offset);
            this.checkDirection(element);
            
            if (this.options.smoothScroll) {
                this.effect = new Effect.Move(this.holder, { 
                    x: -this.scrollPosition,
                    mode: "absolute", 
                    duration: this.options.scrollDuration,
                    afterFinish: this.updateLazyLoader.bind(this)
                });   
            }
        } else {
            var offset = relativeOffset[1];
            if (centerIt && this.options.centerFocus) {
                offset -= (this.containerSize - element.size.height) / 2;
                
                // if scroll snap on then make sure no clipping occurs
                if (this.options.scrollSnap) {
                    var newElement = this.elementCloseTo(offset);
                    offset = newElement.element.positionedOffset()[1];
                }
            }
            
            this.scrollTo(offset);
            this.checkDirection(element);
            
            if (this.options.smoothScroll) {
                this.effect = new Effect.Move(this.holder, { y: -this.scrollPosition, mode: "absolute", duration: this.options.scrollDuration });   
            }
        }
        
        // if autoscroll on, then start timer to scroll to next element
        // only start if there is a next element
        
        this.startAutoScroll(element);
        
        if (!this.options.pagingLoop) {
            if (this.options.pagingType == "per-item") {
                // hide or show buttons depending on whether there is a next or previous element
                // only use this for per item
                this.toggleButton('previous', element.previousElementPaging != null);
                this.toggleButton('next', element.nextElementPaging != null);   
            } else if (this.options.pagingType == "per-page") {
                // per page use the actual scroll position
                this.toggleButton('previous', this.scrollPosition > 0);
                this.toggleButton('next', this.scrollPosition < this.holderSize - this.containerSize);
            }
        } else {
            if (this.elements.length <= 1) {
                this.toggleButton('previous', false);
                this.toggleButton('next', false);
            }
        }
    },
    
    startAutoScroll: function(element) {
        if (this.options.autoScroll) { 
            // depending on auto scroll type, we use a differnet scrolling method
            var methodName;
            
            if (this.options.autoScrollType == "per-page") {
                methodName = "PageElement";
            } else if (this.options.autoScrollType == "per-item") {
                if (element[this.direction + "Element"] != null) {
                    methodName = "Element";
                }
            }
            
            if (methodName) {
                this.timer = setTimeout(function(methodName) {
                    this[this.direction + methodName]("AutoScroll");
                }.bind(this, methodName), this.options.autoScrollDelay * 1000);
            }
        }  
    },
    
    focusElement: function(element) {        
        this.currentKeyScrollElement = element;
        this.currentElement = element;
        
        this.elements.each(function(e) {
            e.element.classNames().remove(this.options.focusedClass);
        }.bind(this));
        
        // add a focus class so we can style it
        element.element.classNames().add(this.options.focusedClass);
        
        // Call any focus callbacks
        if (this.focusEvents) {
            this.focusEvents.each(function(func) {
                func(element);
            }.bind(this));
        }
    },
    
    toggleButton: function(buttonName, show) {
        var button = this[buttonName + "PageButton"];
        var disabledButton = this[buttonName + "DisableButton"];
  
        if (button) {
            if (disabledButton) {
                button[show ? 'show' : 'hide']();
                disabledButton[show ? 'hide' : 'show']();
            } else {
                button.classNames()[show ? 'remove' : 'add' ](this.options[buttonName + "DisabledClass"]);
            }
        }
    },
    
    clampScroll: function() {
        var maxScroll = this.holderSize - this.containerSize;        

        if (this.scrollPosition >= maxScroll) {
            this.scrollPosition = maxScroll;
        }
        
        if (this.scrollPosition <= 0) {
            this.scrollPosition = 0;
        }
    },
    
    scrollTo: function(position, snap) {
        if (!this.options.smoothScroll) {
            snap = true;
        }
        
        this.scrollPosition = position;
        this.clampScroll();
        
        // clamp it
        if (this.scrollPosition < 0) {
            this.scrollPosition = 0;
        }
        
        // if they want to snap straight to it, then do so
        if (snap) {
            if (this.options.orientation == "horizontal") {
                this.holder.setStyle({ 'left': -this.scrollPosition + "px" });
            } else {
                this.holder.setStyle({ 'top': -this.scrollPosition + "px" });                
            }
        }
        
        return;
    },
    
    setupPageButtons: function() {        
        [ 'previous', 'next' ].each(function(buttonName) {
            var pageClass = this.options[buttonName + "PageClass"];
            var button = this.wrapper.getElementsBySelector("." + pageClass).first();
            
            if (button == null) {
                button = new Element("div", { 'class': pageClass });
                this.wrapper.appendChild(button);
            }
                        
            // use different methods for next page and next item
            var methodName;
            if (this.options.pagingType == "per-page") {
                methodName = "PageElement";
            } else if (this.options.pagingType == "per-item") {
                methodName = "Element";
            }
            
            button.observe('click', function(buttonName, methodName) {
                this[buttonName + methodName]("Paging");
            }.bind(this, buttonName, methodName));
            
            // if IE create a separate button for disabled  state
            if (hasNoAlphaSupport && this.options.iePNGFix == true) {
                var disablePageClass = this.options[buttonName + "DisabledClass"];
                var disableButton = new Element("div", { 'class': disablePageClass });

                button.iePNGFix();
                button.insert({ after: disableButton });

                disableButton.iePNGFix();
                disableButton.hide();
                
                this[buttonName + "DisableButton"] = disableButton;
            }

            this[buttonName + "PageButton"] = button;
        }.bind(this));
    },
    
    getKeyScrollElement: function(type) {
        var element = this.currentKeyScrollElement[type + "ElementKeyScroll"];
        
        var maxScroll = this.holderSize - this.containerSize;
        var halfContainerSize = this.containerSize / 2;

        if (this.options.centerFocus) {
            if (this.scrollPosition == 0) {
                if (this.options.keyScrollLoop && type == "previous") {
                    element = this.elementCloseTo(this.holderSize - halfContainerSize); 
                } else {
                    element = this.elementCloseTo(this.scrollPosition + halfContainerSize);
                    element = element[type + "ElementKeyScroll"]; 
                }
            }
        }

        if (this.scrollPosition >= maxScroll) {
            if (this.options.keyScrollLoop && type == "next") {
                if (this.options.centerFocus) {
                    element = this.elementCloseTo(halfContainerSize); 
                } else {
                    element = this.elements.first();
                }
            } else {
                if (this.options.centerFocus) {
                    element = this.elementCloseTo(this.scrollPosition + halfContainerSize);
                } else {
                    element = this.elementCloseTo(this.scrollPosition);   
                }
                
                element = element[type + "ElementKeyScroll"]; 
            }
        }
        
        if (element) this.currentKeyScrollElement = element;
        return this.currentKeyScrollElement;
        
        /*
        
        if (this.options.keyScrollType == "per-item") {
            
            var halfContainerSize = 0;
            var position = this.scrollPosition;
            
            var maxScroll = this.holderSize - this.containerSize;        
            
            // if center required, then center the position
            if (this.options.centerFocus) {
                halfContainerSize = this.containerSize / 2;                
                position += halfContainerSize;
            }
            
            // maxmimum left scrolling position
            console.log(position)
            // loop if required
            switch (type) {
                case "previous":
                    if (position <= halfContainerSize) {
                        return this.elements.last();
                    }
                    break;
                case "next":
                    if (position >= maxScroll + halfContainerSize) {
                        return this.elements.first();
                    }
                    break;
            }
            
            return this.elementCloseTo(position);
        }
        
        return null;*/
    },
    
    nextOrPreviewElement: function(direction, type) {
        var element = this.currentElement;    
        var focusIt = true;
        
        type = type || "";
        if (type == "AutoScroll") type = "";
        
        if (type == 'KeyScroll' && this.options.keyScrollType == "per-item") {
            focusIt = false;
            element = this.getKeyScrollElement(direction);
        } else {
            element = element[direction + "Element" + type];
        }
        
        this.scrollToElement(element, true, focusIt);
    },
    
    previousElement: function(type) {
        this.nextOrPreviewElement('previous', type);
    },
    
    nextElement: function(type) {
        this.nextOrPreviewElement('next', type);
    },
    
    previousPageElement: function(type) {
        var position = this.scrollPosition;
        
        // if key scroll activated and key scroll loop is on, then loop it
        if (type == "Paging" && this.options.pagingLoop ||
            type == "KeyScroll" && this.options.keyScrollLoop) {
            if (position == 0) position = this.currentHolderSize();
        }
        
        position -= this.containerSize;
        
        this.scrollToElement(this.elementCloseTo(position));
    },
    
    nextPageElement: function(type) {
        var position = this.scrollPosition + this.containerSize;
        
        // if key scroll activated and key scroll loop is on, then loop it
        if (type == "Paging" && this.options.pagingLoop ||
            type == "KeyScroll" && this.options.keyScrollLoop ||
            type == "AutoScroll" && this.options.autoScrollFinishAction == "rewind") {
            if (position >= this.currentHolderSize()) position %= this.currentHolderSize();
        }
        
        this.scrollToElement(this.elementCloseTo(position));
    },
    
    elementCloseTo: function(position) {
        // make sure were in range of the container
        if (position < 0) {
            position = 0;
        }
        
        if (position > this.currentHolderSize()) {
            position = this.currentHolderSize();
        }
        
        var offsetIndex = (this.options.orientation == "horizontal") ? 0 : 1;
        var closestElement = null;
        var closestDistance = null;
        
        // search and find the closest element to the given point
        for (var i = this.elements.length - 1; i >= 0; i--) {
            var element = this.elements[i];
            var offset = element.element.positionedOffset();
            
            var currentDistance = Math.abs(offset[offsetIndex] - position);
            
            // if an element is closer then a previously found one, then use that one
            if ((currentDistance < closestDistance) || closestDistance == null) {
                closestDistance = currentDistance;
                closestElement = element;
            } 
        }
        
        return closestElement;
    },
    
    keyScroll: function(event) {
        var methodName;
        
        switch (this.options.keyScrollType) {
            case "per-page":
                methodName = "PageElement";
                break;
            case "per-item":
                methodName = "Element";
                break;
            case "per-item-and-focus":
                methodName = "Element";
                break;
        }
        
        switch (event.keyCode) {
            case this.previousKey:
                this["previous" + methodName]("KeyScroll");
                break;
            case this.nextKey:
                this["next" + methodName]("KeyScroll");
                break;
        }
    },
    
    /* Used to find the buggest element in the sequence */
    setMaxSizeIfGreater: function(newSize) {
        if (this.maxSize == null || this.maxSize < newSize) {
            this.maxSize = newSize;
        }
    }
});

Sequence.Element = Class.create({
    options: {
    },
    
    initialize: function(element, sequence, options) {
        this.options = Object.extend(Object.extend({}, this.options), options || {});
        
        this.element = element;
        this.sequence = sequence;
        
        this.setup();
    },
    
    setup: function() {
        // make sure the elements are all on the same line
        if (this.options.orientation == "horizontal") {
            this.element.setStyle({ 'float': 'left' });   
        } else {
            this.element.setStyle({ 
                'display': 'block',
                'position': 'absolute',
                'top': this.sequence.holder.getHeight() + "px"
            }); 
        }
        
        // store the size of the element
        this.size = { width: this.element.getWidth(), height: this.element.getHeight() };
        
        var widthOrHeight = this.sequence.widthOrHeight();
        
        // find the biggest element
        this.sequence.setMaxSizeIfGreater(this.size[widthOrHeight]);
        
        var margins;
        
        if (this.options.orientation == "horizontal") {
            margins = parseInt(this.element.getStyle('margin-left') || 0) + parseInt(this.element.getStyle('margin-right') || 0);
        } else {
            margins = parseInt(this.element.getStyle('margin-top') || 0) + parseInt(this.element.getStyle('margin-bottom') || 0);
        }
        
        // set the new size of the holder so it fits the new element added   
        // margin is included in the height too
        this.sequence.setHolderSize(
            this.sequence.currentHolderSize() +
            this.size[widthOrHeight] +
            margins
        );
        
        this.setupIteration();
        this.setupFocus();
        
        this.sequence.holder.insert(this.element);
    },
    
    mouseClickTo: function(event) {
        if (!this.options.enableClickEvents) {
            event.stop();
        }
        
        this.sequence.scrollToElement(this, true, true);
    },
    
    setupFocus: function() {
        // if focus on click, then scroll to element on click
        if (this.options.focusOnClick) {
            this.element.observe('click', this.mouseClickTo.bindAsEventListener(this));
        }
    },
    
    setupIteration: function() {
        // store next and previous elements for easy scrolling
        var last = this.sequence.elements.last();
        if (last) {
            last.nextElement = last.nextElementPaging = last.nextElementKeyScroll = this;   
            this.previousElement = this.previousElementPaging = this.previousElementKeyScroll = last;
        }
    }
});