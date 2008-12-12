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
        keyScrollType: "per-item-and-focus",            // per-page or per-item
        keyScrollLoop: true,
        useKeyScroll: true,
        smoothScroll: true,                             // new option: if false, then scrolling just "snaps"
        scrollDuration: 1
    },
    
    initialize: function(wrapper, selector, options) {
        this.options = Object.extend(Object.extend({}, this.options), options || {});
        
        // if no wrapper found then die
        this.wrapper = $(wrapper);
        if (this.wrapper == null) return;
        
        // if no items then die
        var elements = $$(selector);
        if (elements.length == 0) return;
        
        // find the container
        this.container = this.wrapper.getElementsBySelector("." + this.options.containerClass).first();
        
        this.setupContainer();
        this.setupElements(elements);
        this.setupPageButtons();
        this.setupKeyScroll();
        
        this.direction = "next";
        
        this.scrollToElement(this.elements.first(), true, true);
    },
    
    setupKeyScroll: function() {
        if (!this.options.useKeyScroll) return;
        
        document.observe("keydown", this.keyScroll.bindAsEventListener(this));  
    },
    
    setupContainer: function() {
        this.container.setStyle({ position: "relative", overflow: "hidden" });
        this.holder = new Element("div");
        this.holder.setStyle({ position: "absolute", overflow: "hidden" });
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
        // check direction and change if neccessary
        if (this.options.autoScrollFinishAction == "reverse") {
            if (this.direction == "previous" && element.previousElement == null) {
                this.direction = "next";
            }
            
            if (this.direction == "next" && element.nextElement == null) {
                this.direction = "previous";
            }
        }
    },
    
    scrollToElement: function(element, centerIt, focusIt) {
        if (element == null) return;
        
        if (focusIt) {
            this.focusElement(element);
        }
        
        this.checkDirection(element);
        
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
            if (this.options.smoothScroll) {
                this.effect = new Effect.Move(this.holder, { x: -this.scrollPosition, mode: "absolute", duration: this.options.scrollDuration });   
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
            if (this.options.smoothScroll) {
                this.effect = new Effect.Move(this.holder, { y: -this.scrollPosition, mode: "absolute", duration: this.options.scrollDuration });   
            }
        }
        
        // if autoscroll on, then start timer to scroll to next element
        // only start if there is a next element
        
        if (this.options.autoScroll && element[this.direction + "Element"] != null) {
            // depending on auto scroll type, we use a differnet scrolling method
            var methodName;
            if (this.options.autoScrollType == "per-page") {
                methodName = "PageElement";
            } else if (this.options.autoScrollType == "per-item") {
                methodName = "Element";
            }
            
            this.timer = setTimeout(function(methodName) {
                this[this.direction + methodName]();
            }.bind(this, methodName), this.options.autoScrollDelay * 1000);
        }
        
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
    },
    
    focusElement: function(element) {
        this.currentElement = element;
        
        this.elements.each(function(e) {
            e.element.classNames().remove(this.options.focusedClass);
        }.bind(this));
        
        // add a focus class so we can style it
        element.element.classNames().add(this.options.focusedClass);
    },
    
    toggleButton: function(buttonName, show) {
        var button = this[buttonName + "PageButton"];
        var disabledButton = this[buttonName + "DisableButton"];
        
        if (button) {
            if (disabledButton) {
                button[show ? 'show' : 'hide'];
                disabledButton[show ? 'hide' : 'show'];
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
        var isIE = (/MSIE (5\.5|6\.)/.test(navigator.userAgent) && navigator.platform == "Win32");
        
        [ 'previous', 'next' ].each(function(buttonName) {
            var pageClass = this.options[buttonName + "PageClass"];
            var button = this.wrapper.getElementsBySelector("." + pageClass).first();
            
            if (button == null) {
                button = new Element("div", { 'class': pageClass });
                this.wrapper.appendChild(button);
            }
            
            button.iePNGFix();
            
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
            if (isIE) {
                var disablePageClass = this.options[buttonName + "DisabledClass"];
                var disableButton = new Element("div", { 'class': disablePageClass });
                
                disableButton.iePNGFix();
                disableButton.hide();
                
                button.insert({ after: disableButton });
                
                this[buttonName + "DisableButton"] = disableButton;
            }

            this[buttonName + "PageButton"] = button;
        }.bind(this));
    },
    
    getKeyScrollElement: function(type) {
        if (this.options.keyScrollType == "per-item") {
            var position = this.scrollPosition;
            
            // if center required, then center the position
            if (this.options.centerFocus) {
                position += this.containerSize / 2;
            }
            
            // maxmimum left scrolling position
            var maxScroll = this.holderSize - this.containerSize;        
            
            // loop if required
            switch (type) {
                case "previous":
                    if (position <= 0) {
                        return this.elements.first();
                    }
                    break;
                case "next":
                    if (position >= maxScroll) {
                        return this.elements.last();
                    }
                    break;
            }
            
            return this.elementCloseTo(position);
        }
        
        return null;
    },
    
    previousElement: function(type) {
        var keyScrollElement = (type == "KeyScroll") ? this.getKeyScrollElement("previous") : null;
        var element = keyScrollElement || this.currentElement;
        
        this.scrollToElement(element["previousElement" + type], true, keyScrollElement == null);
    },
    
    nextElement: function(type) {
        var keyScrollElement = (type == "KeyScroll") ? this.getKeyScrollElement("next") : null;
        var element = keyScrollElement || this.currentElement;
        
        this.scrollToElement(element["nextElement" + type], true, keyScrollElement == null);
    },
    
    previousPageElement: function() {
        this.scrollToElement(this.elementCloseTo(this.scrollPosition - this.containerSize));
    },
    
    nextPageElement: function() {
        this.scrollToElement(this.elementCloseTo(this.scrollPosition + this.containerSize));
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
        for (var i = 0; i < this.elements.length; i++) {
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
            this.element.setStyle({ 'display': 'block' });               
        }
        
        // store the size of the element
        this.size = { width: this.element.getWidth(), height: this.element.getHeight() };
        
        var widthOrHeight = this.sequence.widthOrHeight();
        
        var margins;
        
        if (this.options.orientation == "horizontal") {
            margins = parseInt(this.element.getStyle('margin-left')) + parseInt(this.element.getStyle('margin-right'));
        } else {
            margins = parseInt(this.element.getStyle('margin-top')) + parseInt(this.element.getStyle('margin-bottom'));
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