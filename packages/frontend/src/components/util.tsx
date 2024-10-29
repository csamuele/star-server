import {Box} from "@mui/material";
import { useEffect } from "react";
import { DateTime } from "luxon";
import { useTranslation } from "react-i18next";
import en from '../i18n/en.yaml';
import { Tip } from "./styles";
import i18n from "~/i18n/i18n";
import { TermType } from "@equal-vote/star-vote-shared/domain_model/ElectionSettings";

const rLink = /\[(.*?)\]\((.*?)\)/;
const rBold = /\*\*(.*?)\*\*/;
const rTip = / \!tip\((.*)\)/;

declare namespace Intl {
    class ListFormat {
        constructor(locales?: string | string[], options?: {});
        public format: (items: string[]) => string;
    }
    class DateTimeFormat {
        constructor(tz?: string, options?: {});
        public format: (item: DateTime) => string;
    }
}

export const commaListFormatter = new Intl.ListFormat(i18n.languages[0], { style: 'long', type: 'conjunction' });

export const useOnScrollAnimator = () => {
    //https://www.youtube.com/watch?v=T33NN_pPeNI
    const observer = new IntersectionObserver((entries) => {
        entries.filter(entry => entry.isIntersecting).forEach(entry => entry.target.classList.add('show'))
    })

    useEffect(() => {
        document.querySelectorAll('.scrollAnimate').forEach(ref => observer.observe(ref))
    })

    const makeSx=(delay, duration, before={}, after={}) => ({
          opacity: 0, ...before,
            '&.show': {opacity: 1, transition: `all ${duration}`, transitionDelay: delay, ...after}
      })

    return {
        FadeIn: ({children, delay='0', duration='1s'}) => <Box className='scrollAnimate' sx={makeSx(delay, duration)}>
            {children}
        </Box>,
        FadeUp: ({children, delay='0', duration='1s'}) => <Box className='scrollAnimate' sx={
          makeSx(delay, duration, {transform: 'translate(0, 40px)'}, {transform: 'translate(0, 0)'})
        }>
            {children}
        </Box>,
    }
}

// NOTE: I'm setting a electionTermType default for backwards compatibility with elections that don't have a term set
export const useSubstitutedTranslation = (electionTermType='election', v={}) => { // election or poll
  const processValues = (values) => {
    Object.entries(values).forEach(([key, value]) => {
      if(typeof value === 'string'){
        if(key == 'datetime' || key == 'datetime2' || key == 'listed_datetime'){
          values[key] = new Date(value)
        }else{
          values[`lowercase_${key}`] = value.toLowerCase()
        }
      }
      if(Array.isArray(value)){
        values[key] = commaListFormatter.format(value);
      }
    })
    return values
  }

  let dt = {
      year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric',
      timeZoneName: 'short', timeZone: v['time_zone'] ?? undefined
    }

  let values = processValues({...en.keyword, ...en.keyword[electionTermType], ...v, formatParams: {
    datetime: dt,
    datetime2: dt,
    listed_datetime: {
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
      timeZoneName: undefined, timeZone: v['time_zone'] ?? undefined
    },
  }})

  const { t, i18n } = useTranslation()

  const applySymbols = (txt) => {
    const applyLinks = (txt) => {
      if(typeof txt !== 'string') return txt;
      let parts = txt.split(rLink)
      return parts.map((str, i) => {
        if(i%3 == 0) return str;
        if(i%3 == 2) return '';
        return <a key={`link_${i}`} href={parts[i+1]}>{parts[i]}</a>
      })
    }

    const applyBold = (txt, keyPrefix) => {
      if(typeof txt !== 'string') return txt;
      return txt.split(rBold).map((str, i) => {
        if(i%2 == 0) return str
        return <b key={`b_${keyPrefix}_${i}`}>{str}</b>;
      })
    }

    const applyTips = (txt, keyPrefix) => {
      if(typeof txt !== 'string') return txt;
      return txt.split(rTip).map((str, i) => {
          if(i%2 == 0) return str;
          return <Tip key={`tip_${keyPrefix}_${i}`} name={str} electionTermType={electionTermType as TermType}/>
      })
    }

    const applyLineBreaks = (txt, keyPrefix) => {
      if(typeof txt !== 'string') return txt;
      let parts = txt.split('\n');
      return parts.map((part,i) => i == (parts.length-1)? part : [part, <br key={`br_${keyPrefix}_${i}`}/>]).flat();
    }

    // hack for testing if we've missed any text
    // return '----'; 

    if(!rLink.test(txt) && !rTip.test(txt) && !txt.includes('\n') && !rBold.test(txt)) return txt;

    return <>
      {applyLinks(txt)
        .map((comp, i) => applyTips(comp, i)).flat()
        .map((comp, i) => applyLineBreaks(comp, i)).flat()
        .map((comp, i) => applyBold(comp, i)).flat()
      }
    </>
  }

  const handleObject = (obj) => {
    if(typeof obj == 'number') return obj;
    if(typeof obj === 'string') return applySymbols(obj);
    if(Array.isArray(obj)) return obj.map(o => handleObject(o));

    let newObj = {};
    Object.entries(obj).forEach(([key, value]) => {
      newObj[key] = handleObject(value);
    })
    return newObj;
  }

  return {
    t: (key, v={}) => handleObject(t(key, {...values, ...processValues(v)})),
    i18n,
  }
}

export const CHART_COLORS = [
  "var(--ltbrand-blue)",
  "var(--ltbrand-green)",
  "var(--ltbrand-lime)",
];

export const truncName = (name, maxSize) => {
  if (!(typeof name === 'string')) return name;
  if (name.length <= maxSize) return name;
  return name.slice(0, maxSize - 3).concat("...");
};



export const openFeedback = () => {
  // simulate clicking the feedback button
  const launcherFrame = document.getElementById("launcher-frame");
  const button =
    (launcherFrame as HTMLIFrameElement).contentWindow.document.getElementsByClassName(
      "launcher-button"
    )[0];
  (button as HTMLButtonElement).click();
};

export function scrollToElement(e) {
  setTimeout(() => {
    // TODO: I feel like there's got to be an easier way to do this
    let openedSection = typeof e === "function" ? e() : e;

    if (NodeList.prototype.isPrototypeOf(openedSection)) {
      // NOTE: NodeList could contain a bunch of hidden elements with height 0, so we're filtering those out
      openedSection = Array.from(openedSection).filter((e) => {
        const box = (e as HTMLElement).getBoundingClientRect();
        return box.bottom - box.top > 0;
      });
      if (openedSection.length == 0) return;
      openedSection = openedSection[0];
    }

    const navBox = document.querySelector("header").getBoundingClientRect();
    const navHeight = navBox.bottom - navBox.top;

    const elemTop =
      document.documentElement.scrollTop +
      openedSection.getBoundingClientRect().top -
      30;
    const elemBottom = elemTop + openedSection.scrollHeight;
    const windowTop = document.documentElement.scrollTop;
    const windowBottom = windowTop + window.innerHeight;

    if (elemTop < windowTop || elemBottom > windowBottom) {
      window.scrollTo({
        top: elemTop - navHeight,
        behavior: "smooth",
      });
    }
  }, 250);
}

export const epochToDateString = (e) => {
  let d = new Date(0);
  d.setUTCSeconds(e / 1000);
  return d.toString();
}

export const isValidDate = (d) => {
  if (d instanceof Date) return !isNaN(d.valueOf());
  if (typeof d === "string") return !isNaN(new Date(d).valueOf());
  return false;
};

export const getLocalTimeZoneShort = () => {
  return DateTime.local().offsetNameShort
}
