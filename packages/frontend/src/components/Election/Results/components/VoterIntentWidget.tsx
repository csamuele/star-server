import useAnonymizedBallots from "~/components/AnonymizedBallotsContextProvider";
import useElection from "~/components/ElectionContextProvider";
import Widget from "./Widget";
import useRace from "~/components/RaceContextProvider";
import { useState } from "react";
import { Box, Divider, MenuItem, Paper, Select, Typography } from "@mui/material";
import { CHART_COLORS } from "~/components/util";
import { Candidate } from "@equal-vote/star-vote-shared/domain_model/Candidate";
import HeadToHeadChart from "./HeadToHeadChart";
import ResultsPieChart from "./ResultsPieChart";
import ResultsKey from "./ResultsKey";
import ResultsTable from "./ResultsTable";
import { Tip } from "~/components/styles";
import { irvResults } from "@equal-vote/star-vote-shared/domain_model/ITabulators";

// eliminationOrder is an array of candidateIds
export default ({eliminationOrderById, winnerId} : {eliminationOrderById : string[], winnerId: string}) => {
    const {t} = useElection();
    let {race, results} = useRace();
    const {ballots, ballotsForRace} = useAnonymizedBallots();

    results = results as irvResults;

    const sortedCandidates = race.candidates
        .map(c => ({...c, index: results.summaryData.candidates.find(cc => cc.name == c.candidate_name).index}))
        .sort((a, b) => {
        // prioritize ranking in later rounds, but use previous rounds as tiebreaker
        let i = results.voteCounts.length-1;
        while(i >= 0){
            let diff = -(results.voteCounts[i][a.index] - results.voteCounts[i][b.index]);
            if(diff != 0) return diff;
            i--;
        }
        return 0;
        })
        .map(c => ({candidate_id: c.candidate_id, candidate_name: c.candidate_name}));


    let [winner_name, runner_up_name] = sortedCandidates.slice(0, 2).map(c => c.candidate_name);

    const final_round_candidates = results.voteCounts.slice(-1)[0].filter(c => c != 0).length;
    if(final_round_candidates > 2){
        runner_up_name = 'a losing candidate'
    }

    let data = [
        { // Type 1: !hasPassedOver && isWinner
            name: `Voter was counted toward ${winner_name} and all their preferences above ${winner_name} were counted`,
            votes: 0,
            color: 'var(--ltbrand-green)'
        },
        { // Type 2: !hasPassedOver && !isWinner && !trailingRanks
            // name: All rankings counted but disliked winner. Additional candidates after winner left blank
            // name: 'Your vote was allocated to a losing candidate but all your preferences were counted.',
            name: `Voter didn't support ${winner_name} but all their preferences were still counted`,
            votes: 0,
            color: 'var(--ltbrand-lime)'
        },
        { // Type 3:  hasPassedOver
            // name: 'Voter\'s preferred candidates were not counted due to order of elimination.',
            name: "Vote couldn't transfer to next choice after an elimination because next choice was already eliminated",
            votes: 0,
            color: 'var(--ltbrand-red)'
        },
        { // Type 4: !hasPassedOver && !isWinner && trailingRanks
            // name: 'Voter\'s next choice wasn\'t counted after their top choice lost in the final round.',
            name: `Voter was counted toward ${runner_up_name} but voter had more uncounted preferences`,
            votes: 0,
            color: 'var(--brand-orange)'
        },
    ];

    let b = ballotsForRace();
    let numBallots = b.length;
    let numPref = 0;
    let numIgnored = 0;
    b.map((scores) => {
        let ranksLeft = scores
            .filter(s => s.score != null)
            .sort((a, b) => a.score - b.score);
        
        numPref += ranksLeft.length;

        if(ranksLeft.length == 0){
            numBallots--;
            return;
        }
        let cs = race.candidates;
        // keeping this variable so we have an easy way to debug
        let loggedBallot = ranksLeft.map(s => ({score: s.score, name: cs.find(c => c.candidate_id == s.candidate_id).candidate_name, id: s.candidate_id}))

        let hasPassedOver = false;
        let alreadyEliminated = []

        eliminationOrderById.forEach((elimId) => {
            if(ranksLeft.length == 0) return;
            if(ranksLeft[0].candidate_id == elimId){
                ranksLeft.shift();
                while(ranksLeft.length > 0 && alreadyEliminated.includes(ranksLeft[0].candidate_id)){
                    hasPassedOver = true; 
                    numIgnored++;
                    ranksLeft.shift();
                }
            }
            alreadyEliminated.push(elimId);
        })

        let trailingRanks = ranksLeft.length > 1;
        let isWinner = ranksLeft.length > 0 && ranksLeft[0].candidate_id == winnerId;

        numIgnored += ranksLeft.length-1;

        // loserWithTrailingRanks = !isWinner && trailingRanks
        const ballotType = () => {
            // Type 1: !hasPassedOver && isWinner
            // Type 2: !hasPassedOver && !isWinner && !trailingRanks
            // Type 3:  hasPassedOver
            // Type 4: !hasPassedOver && !isWinner && trailingRanks
            if(hasPassedOver) return 3;
            if(isWinner) return 1;
            if(trailingRanks) return 4;
            return 2;
        }
        data[ballotType()-1].votes++;
    })

    let Definition = ({i}) => <Box key={i} sx={{width: '100%', mb: 2}}>
        <Box display='flex' flexDirection='row' alignContent='stretch' sx={{justifyContent: 'flex-start'}} >
            <Box sx={{
                mr: 1,
                width: '15px',
                my: 0,
                backgroundColor: data[i].color
            }}/>
            <Box display='flex' justifyContent='space-between' gap={1} flexDirection='column' sx={{width: '100%'}}>
                <Typography sx={{maxWidth: '400px', textAlign: 'left'}}>{data[i].name}</Typography>
            </Box>
        </Box>
    </Box>

    return <Widget title='Voter Intent'>
        <Typography sx={{textAlign: 'left'}}>
            In Ranked Choice there's a common misconception that "If your favorite doesn't win, your next choice will be counted" but that didn't
            happen for {Math.round(100*(data[2].votes+data[3].votes)/numBallots)}% of the voters and {Math.round(100*numIgnored / numPref)}%
            of voter's rankings were uncounted in this election.
        </Typography>
        <Box width={'250px'}> {/*Limiting the width so that the hover experience is less awkward*/}
            <ResultsPieChart data={[0, 1, 3, 2].map(i => data[i])} noLegend />
        </Box>
        <Box sx={{width: '100%'}}>
            <Typography sx={{textAlign: 'left', mb: 1}}><b>Intent respected: Vote transferred as intended</b></Typography>
        </Box>
        {[0,1].map(i => <Definition key={i} i={i}/>)}
        <Box sx={{width: '100%', mt: 2}}>
            <Typography sx={{textAlign: 'left', mb: 1}}><b>Intent not respected: Vote didn't transfer as intended</b></Typography>
        </Box>
        {[2,3].map(i => <Definition key={i} i={i}/>)}
        <Typography sx={{textAlign: 'left', mt: 2}}>In some cases uncounted rankings could have made a difference if they had been counted.</Typography>
    </Widget>
}